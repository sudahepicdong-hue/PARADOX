// Efek "percantik" yang berat (haluskan kulit, cerahkan, tiruskan wajah, besarkan mata)
// dikerjakan oleh kartu grafis HP lewat WebGL, supaya tetap lancar 30 frame per detik.

const VS = `
attribute vec2 a;
varying vec2 v_uv;
void main() {
  v_uv = vec2(a.x * 0.5 + 0.5, 0.5 - a.y * 0.5);
  gl_Position = vec4(a, 0.0, 1.0);
}`;

const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_res;
uniform float u_hasFace;
uniform vec2 u_eyeL;
uniform vec2 u_eyeR;
uniform float u_eyeRad;
uniform float u_eye;
uniform vec2 u_sc[4];
uniform vec2 u_st[4];
uniform float u_sr;
uniform vec2 u_faceC;
uniform vec2 u_faceAx;
uniform float u_faceAng;
uniform float u_smooth;
uniform float u_bright;
uniform float u_blurR;

// Perbesar area di sekitar titik c (mata)
vec2 eyeWarp(vec2 p, vec2 c, float r, float s) {
  vec2 d = p - c;
  float l = length(d);
  if (l < r) {
    float k = 1.0 - s * (1.0 - (l * l) / (r * r));
    return c + d * k;
  }
  return p;
}

// Geser area di sekitar titik c ke arah t (tiruskan rahang)
vec2 liquify(vec2 p, vec2 c, vec2 t, float r) {
  vec2 d = p - c;
  float dd = dot(d, d);
  float rr = r * r;
  if (dd < rr) {
    float w = 1.0 - dd / rr;
    w = w * w; // halus: kuat di tengah, nol di tepi (tanpa garis sambungan)
    return p - (t - c) * w;
  }
  return p;
}

void main() {
  vec2 p = v_uv * u_res;
  float faceMask = 0.0;
  if (u_hasFace > 0.5) {
    p = eyeWarp(p, u_eyeL, u_eyeRad, u_eye);
    p = eyeWarp(p, u_eyeR, u_eyeRad, u_eye);
    for (int i = 0; i < 4; i++) p = liquify(p, u_sc[i], u_st[i], u_sr);
    vec2 q = p - u_faceC;
    float cs = cos(-u_faceAng);
    float sn = sin(-u_faceAng);
    q = vec2(q.x * cs - q.y * sn, q.x * sn + q.y * cs) / u_faceAx;
    faceMask = 1.0 - smoothstep(0.55, 1.1, dot(q, q));
  }
  vec2 uv = p / u_res;
  vec3 c0 = texture2D(u_tex, uv).rgb;
  vec3 col = c0;

  // Deteksi warna kulit (YCbCr)
  float Y = dot(c0, vec3(0.299, 0.587, 0.114));
  float cr = (c0.r - Y) * 0.713 + 0.5;
  float cb = (c0.b - Y) * 0.564 + 0.5;
  float skin = smoothstep(0.47, 0.54, cr) * (1.0 - smoothstep(0.66, 0.76, cr))
             * smoothstep(0.22, 0.31, cb) * (1.0 - smoothstep(0.49, 0.57, cb));
  float m = u_hasFace > 0.5 ? faceMask * mix(0.5, 1.0, skin) : skin * 0.5;

  // Haluskan kulit: rata-rata titik sekitar yang warnanya mirip (garis mata/alis/bibir tetap tajam)
  if (u_smooth > 0.0 && m > 0.0) {
    vec3 sum = c0;
    float ws = 1.0;
    for (int i = 0; i < 12; i++) {
      float a = float(i) * 0.5235988;
      vec2 dir = vec2(cos(a), sin(a));
      for (int j = 1; j <= 2; j++) {
        vec2 off = dir * u_blurR * float(j) / u_res;
        vec3 s = texture2D(u_tex, uv + off).rgb;
        vec3 df = s - c0;
        float w = exp(-dot(df, df) * 60.0);
        sum += s * w;
        ws += w;
      }
    }
    col = mix(c0, sum / ws, clamp(u_smooth * m * 1.3, 0.0, 1.0));
  }

  // Cerahkan: kulit paling banyak, sisanya sedikit
  vec3 lighter = 1.0 - (1.0 - col) * (1.0 - col);
  col = mix(col, lighter, u_bright * (m * 0.55 + 0.1));
  gl_FragColor = vec4(col, 1.0);
}`;

export type Vec2 = [number, number];
export interface BeautyUniforms {
  hasFace: boolean;
  eyeL: Vec2;
  eyeR: Vec2;
  eyeRad: number;
  eye: number;
  slimFrom: Vec2[]; // 4 titik rahang
  slimTo: Vec2[];
  slimRad: number;
  faceC: Vec2;
  faceAx: Vec2;
  faceAng: number;
  smooth: number;
  bright: number;
  blurR: number;
}

export class BeautyGL {
  readonly canvas = document.createElement('canvas');
  private gl: WebGLRenderingContext;
  private loc: Record<string, WebGLUniformLocation | null> = {};
  private tex: WebGLTexture;

  // null = HP/browser tidak mendukung WebGL
  static create(): BeautyGL | null {
    try {
      return new BeautyGL();
    } catch {
      return null;
    }
  }

  private constructor() {
    const gl = this.canvas.getContext('webgl', { premultipliedAlpha: false, antialias: false });
    if (!gl) throw new Error('no webgl');
    this.gl = gl;
    const shader = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || 'shader');
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || 'link');
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);

    this.tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    for (const n of ['u_tex', 'u_res', 'u_hasFace', 'u_eyeL', 'u_eyeR', 'u_eyeRad', 'u_eye', 'u_sc', 'u_st', 'u_sr',
      'u_faceC', 'u_faceAx', 'u_faceAng', 'u_smooth', 'u_bright', 'u_blurR']) {
      this.loc[n] = gl.getUniformLocation(prog, n);
    }
    gl.uniform1i(this.loc.u_tex, 0);
  }

  // Gambar satu frame kamera dengan efek percantik; hasilnya ada di this.canvas
  render(source: TexImageSource, w: number, h: number, u: BeautyUniforms) {
    const { gl, loc } = this;
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.uniform2f(loc.u_res, w, h);
    gl.uniform1f(loc.u_hasFace, u.hasFace ? 1 : 0);
    gl.uniform2f(loc.u_eyeL, ...u.eyeL);
    gl.uniform2f(loc.u_eyeR, ...u.eyeR);
    gl.uniform1f(loc.u_eyeRad, u.eyeRad);
    gl.uniform1f(loc.u_eye, u.eye);
    gl.uniform2fv(loc.u_sc, u.slimFrom.flat());
    gl.uniform2fv(loc.u_st, u.slimTo.flat());
    gl.uniform1f(loc.u_sr, u.slimRad);
    gl.uniform2f(loc.u_faceC, ...u.faceC);
    gl.uniform2f(loc.u_faceAx, ...u.faceAx);
    gl.uniform1f(loc.u_faceAng, u.faceAng);
    gl.uniform1f(loc.u_smooth, u.smooth);
    gl.uniform1f(loc.u_bright, u.bright);
    gl.uniform1f(loc.u_blurR, u.blurR);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
