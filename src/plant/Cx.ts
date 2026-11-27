/** Số phức tối giản cho tính toán lưới (đơn vị tương đối) */
export class Cx {
  readonly re: number;
  readonly im: number;

  constructor(re: number, im: number) {
    this.re = re;
    this.im = im;
  }

  plus(o: Cx): Cx {
    return new Cx(this.re + o.re, this.im + o.im);
  }

  minus(o: Cx): Cx {
    return new Cx(this.re - o.re, this.im - o.im);
  }

  times(o: Cx): Cx {
    return new Cx(this.re * o.re - this.im * o.im, this.re * o.im + this.im * o.re);
  }

  scale(k: number): Cx {
    return new Cx(this.re * k, this.im * k);
  }

  div(o: Cx): Cx {
    const d = o.re * o.re + o.im * o.im;
    return new Cx((this.re * o.re + this.im * o.im) / d, (this.im * o.re - this.re * o.im) / d);
  }

  divScalar(k: number): Cx {
    return new Cx(this.re / k, this.im / k);
  }

  neg(): Cx {
    return new Cx(-this.re, -this.im);
  }

  conj(): Cx {
    return new Cx(this.re, -this.im);
  }

  abs(): number {
    return Math.hypot(this.re, this.im);
  }

  arg(): number {
    return Math.atan2(this.im, this.re);
  }

  inv(): Cx {
    return Cx.ONE.div(this);
  }

  static readonly ZERO = new Cx(0.0, 0.0);
  static readonly ONE = new Cx(1.0, 0.0);
  static readonly J = new Cx(0.0, 1.0);

  static polar(r: number, a: number): Cx {
    return new Cx(r * Math.cos(a), r * Math.sin(a));
  }

  /** Toán tử a = 1∠120° của thành phần đối xứng */
  static readonly A = Cx.polar(1.0, (2 * Math.PI) / 3);
  static readonly A2 = Cx.polar(1.0, (-2 * Math.PI) / 3);
}

/** Giải hệ Y·V = I (khử Gauss có chọn trụ). Ma trận bị thay đổi. */
export function solveCx(a: Cx[][], b: Cx[]): Cx[] {
  const n = b.length;
  for (let c = 0; c < n; c++) {
    let p = c;
    let best = a[c][c].abs();
    for (let r = c + 1; r < n; r++) {
      const v = a[r][c].abs();
      if (v > best) {
        best = v;
        p = r;
      }
    }
    if (best < 1e-14) {
      a[c][c] = new Cx(1e-9, 0.0);
    } else if (p !== c) {
      const t = a[p];
      a[p] = a[c];
      a[c] = t;
      const tb = b[p];
      b[p] = b[c];
      b[c] = tb;
    }
    const piv = a[c][c];
    for (let r = c + 1; r < n; r++) {
      const f = a[r][c].div(piv);
      if (f.re === 0.0 && f.im === 0.0) continue;
      for (let k = c; k < n; k++) a[r][k] = a[r][k].minus(f.times(a[c][k]));
      b[r] = b[r].minus(f.times(b[c]));
    }
  }
  const x: Cx[] = new Array(n).fill(Cx.ZERO);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r];
    for (let k = r + 1; k < n; k++) s = s.minus(a[r][k].times(x[k]));
    x[r] = s.div(a[r][r]);
  }
  return x;
}
