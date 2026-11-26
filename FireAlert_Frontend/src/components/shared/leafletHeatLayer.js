const DEFAULT_GRADIENT = {
  0.3: '#FACC15',
  0.65: '#F97316',
  1.0: '#DC2626',
};

function buildColorLut(gradient) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const linear = ctx.createLinearGradient(0, 0, 0, 256);
  Object.entries(gradient).forEach(([stop, color]) => {
    const numericStop = Number(stop);
    if (Number.isFinite(numericStop)) {
      linear.addColorStop(Math.min(1, Math.max(0, numericStop)), color);
    }
  });

  ctx.fillStyle = linear;
  ctx.fillRect(0, 0, 1, 256);
  return ctx.getImageData(0, 0, 1, 256).data;
}

function buildKernel(radius, blur) {
  if (typeof document === 'undefined') return null;
  const r = radius + blur;
  const size = r * 2;
  const circle = document.createElement('canvas');
  circle.width = size;
  circle.height = size;
  const ctx = circle.getContext('2d');
  if (!ctx) return null;

  ctx.shadowOffsetX = size;
  ctx.shadowOffsetY = size;
  ctx.shadowBlur = blur;
  ctx.shadowColor = 'black';

  ctx.beginPath();
  ctx.arc(-r, -r, radius, 0, Math.PI * 2, true);
  ctx.closePath();
  ctx.fill();

  return { canvas: circle, radius: r };
}

/**
 * Self-contained Leaflet canvas heat layer matching Leaflet.heat's API & gradient
 * so it works seamlessly with bundled `leaflet` without external CDN globals.
 */
export function createHeatLayer(L, latlngs = [], options = {}) {
  const HeatLayer = L.Layer.extend({
    options: {
      radius: 32,
      blur: 22,
      maxZoom: 17,
      max: 1.0,
      minOpacity: 0.15,
      gradient: DEFAULT_GRADIENT,
    },

    initialize(points, layerOptions) {
      this._latlngs = Array.isArray(points) ? points : [];
      L.Util.setOptions(this, layerOptions);
    },

    setLatLngs(points) {
      this._latlngs = Array.isArray(points) ? points : [];
      return this.redraw();
    },

    onAdd(map) {
      this._map = map;

      if (!this._canvas) {
        this._initCanvas();
      }

      const pane = this.getPane() || map.getPanes().overlayPane;
      pane.appendChild(this._canvas);

      map.on('moveend', this._reset, this);
      map.on('resize', this._resize, this);

      if (map.options.zoomAnimation && L.Browser.any3d) {
        map.on('zoomanim', this._animateZoom, this);
      }

      this._reset();
    },

    onRemove(map) {
      const pane = this.getPane() || map.getPanes().overlayPane;
      if (this._canvas && this._canvas.parentNode === pane) {
        pane.removeChild(this._canvas);
      }

      map.off('moveend', this._reset, this);
      map.off('resize', this._resize, this);

      if (map.options.zoomAnimation) {
        map.off('zoomanim', this._animateZoom, this);
      }

      this._map = null;
    },

    redraw() {
      if (this._canvas && !this._frame && this._map && !this._map._animating) {
        this._frame = L.Util.requestAnimFrame(this._redraw, this);
      }
      return this;
    },

    _initCanvas() {
      const canvas = L.DomUtil.create('canvas', 'leaflet-heatmap-layer leaflet-layer');
      const originProp = L.DomUtil.testProp(['transformOrigin', 'WebkitTransformOrigin', 'msTransformOrigin']);
      if (originProp) {
        canvas.style[originProp] = '50% 50%';
      }

      const size = this._map.getSize();
      canvas.width = size.x;
      canvas.height = size.y;

      const animated = this._map.options.zoomAnimation && L.Browser.any3d;
      L.DomUtil.addClass(canvas, `leaflet-zoom-${animated ? 'animated' : 'hide'}`);

      this._canvas = canvas;
      this._ctx = canvas.getContext('2d');
      this._width = size.x;
      this._height = size.y;
      this._grad = buildColorLut(this.options.gradient || DEFAULT_GRADIENT);
      this._kernel = buildKernel(this.options.radius ?? 32, this.options.blur ?? 22);
    },

    _resize() {
      if (!this._map || !this._canvas) return;
      const size = this._map.getSize();
      this._canvas.width = size.x;
      this._canvas.height = size.y;
      this._width = size.x;
      this._height = size.y;
      this._reset();
    },

    _reset() {
      if (!this._map || !this._canvas) return;
      const topLeft = this._map.containerPointToLayerPoint([0, 0]);
      L.DomUtil.setPosition(this._canvas, topLeft);
      this._redraw();
    },

    _animateZoom(e) {
      if (!this._map || !this._canvas) return;
      const scale = this._map.getZoomScale(e.zoom);
      const offset = this._map._getCenterOffset(e.center)._multiplyBy(-scale).subtract(this._map._getMapPanePos());
      if (L.DomUtil.setTransform) {
        L.DomUtil.setTransform(this._canvas, offset, scale);
      } else {
        this._canvas.style[L.DomUtil.TRANSFORM] = `${L.DomUtil.getTranslateString(offset)} scale(${scale})`;
      }
    },

    _redraw() {
      this._frame = null;
      if (!this._map || !this._canvas || !this._ctx || !this._kernel || !this._grad) return;

      const ctx = this._ctx;
      const width = this._width;
      const height = this._height;
      ctx.clearRect(0, 0, width, height);

      if (!this._latlngs.length || width === 0 || height === 0) return;

      const r = this._kernel.radius;
      const maxIntensity = this.options.max || 1.0;
      const minOpacity = this.options.minOpacity ?? 0.15;
      const maxZoom = this.options.maxZoom ?? this._map.getMaxZoom();
      const zoomScale = 1 / Math.pow(2, Math.max(0, Math.min(maxZoom - this._map.getZoom(), 12)));
      const cellSize = Math.max(1, Math.round(r / 2));
      const grid = [];

      const panePos = this._map._getMapPanePos();
      const offsetX = panePos.x % cellSize;
      const offsetY = panePos.y % cellSize;

      this._latlngs.forEach((point) => {
        const lat = Array.isArray(point) ? Number(point[0]) : Number(point?.lat ?? point?.latitude);
        const lng = Array.isArray(point) ? Number(point[1]) : Number(point?.lng ?? point?.longitude);
        const intensity = Array.isArray(point) ? Number(point[2] ?? 0.5) : Number(point?.intensity ?? 0.5);

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

        const p = this._map.latLngToContainerPoint([lat, lng]);
        if (p.x < -r || p.x > width + r || p.y < -r || p.y > height + r) return;

        const x = Math.floor((p.x - offsetX) / cellSize) + 2;
        const y = Math.floor((p.y - offsetY) / cellSize) + 2;
        const alt = Number.isFinite(intensity) ? intensity : 0.5;
        const k = alt * zoomScale;

        grid[y] = grid[y] || [];
        const cell = grid[y][x];
        if (!cell) {
          grid[y][x] = [p.x, p.y, k];
        } else {
          cell[0] = (cell[0] * cell[2] + p.x * k) / (cell[2] + k);
          cell[1] = (cell[1] * cell[2] + p.y * k) / (cell[2] + k);
          cell[2] += k;
        }
      });

      const drawn = [];
      for (let i = 0; i < grid.length; i++) {
        if (!grid[i]) continue;
        for (let j = 0; j < grid[i].length; j++) {
          const cell = grid[i][j];
          if (cell) {
            drawn.push([
              Math.round(cell[0]),
              Math.round(cell[1]),
              Math.min(cell[2], maxIntensity),
            ]);
          }
        }
      }

      if (!drawn.length) return;

      drawn.forEach(([x, y, val]) => {
        ctx.globalAlpha = Math.min(Math.max(val / maxIntensity, minOpacity), 1);
        ctx.drawImage(this._kernel.canvas, x - r, y - r);
      });

      const colored = ctx.getImageData(0, 0, width, height);
      const pixels = colored.data;
      for (let i = 0; i < pixels.length; i += 4) {
        const alpha = pixels[i + 3];
        if (alpha > 0) {
          const j = alpha * 4;
          pixels[i] = this._grad[j];
          pixels[i + 1] = this._grad[j + 1];
          pixels[i + 2] = this._grad[j + 2];
        }
      }
      ctx.putImageData(colored, 0, 0);
    },
  });

  return new HeatLayer(latlngs, options);
}
