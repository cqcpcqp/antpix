/* global require, module, window */
const { paint } = require('./startup/painter');
const layout = require('./startup/layout.js');
const paths = require('./startup/assets.js');
let gl;
let surface;
let ctx;
let images;
let texture;
let program;
let buffer;
let progress = 0;
let ended = false;
let minimumTextSize = 24;

// Render a 2D composition into the main WebGL canvas, leaving its context available
// for Cocos. Never request a 2D context from the main canvas before engine startup.
function shader(type, source) {
    const result = gl.createShader(type);
    gl.shaderSource(result, source);
    gl.compileShader(result);
    if (!gl.getShaderParameter(result, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(result));
    return result;
}
function initialize() {
    gl = globalThis.canvas.getContext('webgl', {
        alpha: false,
        antialias: true,
        depth: true,
        stencil: true,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
    });
    window.WebGL2RenderingContext = false;
    const vertex = shader(
        gl.VERTEX_SHADER,
        `
    attribute vec2 position;
    attribute vec2 uv;
    varying vec2 texCoord;
    void main() { gl_Position = vec4(position, 0.0, 1.0); texCoord = uv; }
  `,
    );
    const fragment = shader(
        gl.FRAGMENT_SHADER,
        `
    precision mediump float;
    uniform sampler2D image;
    varying vec2 texCoord;
    void main() { gl_FragColor = texture2D(image, texCoord); }
  `,
    );
    program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
        throw new Error(gl.getProgramInfoLog(program));
    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 0, 1, 1, -1, 1, 1, -1, 1, 0, 0, 1, 1, 1, 0]),
        gl.STATIC_DRAW,
    );
    texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    surface = wx.createCanvas();
    // Match the engine's logical viewport and keep the temporary texture modest.
    const scale = Math.min(1, 1024 / globalThis.canvas.height);
    surface.width = Math.round(globalThis.canvas.width * scale);
    surface.height = Math.round(globalThis.canvas.height * scale);
    ctx = surface.getContext('2d');
    const logicalWidth = Math.max(
        layout.width,
        (layout.minimumHeight * surface.width) / surface.height,
    );
    minimumTextSize = (12 * logicalWidth) / wx.getSystemInfoSync().windowWidth;
}
function draw() {
    paint(ctx, surface, images, progress, layout.loading, minimumTextSize);
    gl.viewport(0, 0, globalThis.canvas.width, globalThis.canvas.height);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, surface);
    gl.uniform1i(gl.getUniformLocation(program, 'image'), 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    for (const [name, offset] of [
        ['position', 0],
        ['uv', 8],
    ]) {
        const location = gl.getAttribLocation(program, name);
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 16, offset);
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}
function loadImage(path) {
    return new Promise((resolve, reject) => {
        const image = wx.createImage();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = path;
    });
}
async function start() {
    initialize();
    const [background, title] = await Promise.all([
        loadImage(paths.background),
        loadImage(paths.title),
    ]);
    images = { background, title };
    return setProgress(0);
}
function setProgress(value) {
    if (ended) return Promise.resolve();
    progress = Math.max(progress, value * layout.engineProgress);
    draw();
    return new Promise((resolve) => globalThis.requestAnimationFrame(resolve));
}
async function end() {
    await setProgress(1);
    ended = true;
    gl.useProgram(null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.deleteTexture(texture);
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
    surface = null;
    ctx = null;
    images = null;
}
module.exports = { start, setProgress, end };
