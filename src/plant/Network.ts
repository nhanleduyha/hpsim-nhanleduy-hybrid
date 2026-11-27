import { Cx, solveCx } from './Cx';

export class Sw {
  readonly name: string;
  readonly a: number;
  readonly b: number;
  closed = false;
  i: Cx = Cx.ZERO;

  constructor(name: string, a: number, b: number) {
    this.name = name;
    this.a = a;
    this.b = b;
  }
}

/** Nhánh tổng trở z; t = tỉ số biến áp ngoài định mức đặt ở phía a (nấc phân áp), i = dòng vào nhánh tại a, ib = dòng ra tại b */
export class Br {
  readonly name: string;
  readonly a: number;
  readonly b: number;
  z: Cx;
  on = true;
  t = 1.0;
  i: Cx = Cx.ZERO;
  ib: Cx = Cx.ZERO;

  constructor(name: string, a: number, b: number, z: Cx) {
    this.name = name;
    this.a = a;
    this.b = b;
    this.z = z;
  }
}

export class Src {
  readonly node: number;
  y: Cx = Cx.ZERO;
  inj: Cx = Cx.ZERO;
  on = false;
  i: Cx = Cx.ZERO;

  constructor(node: number) {
    this.node = node;
  }
}

/**
 * Lưới điện dạng nút – nhánh – khoá (máy cắt, dao cách ly).
 * Mỗi lần giải: gộp các nút nối với nhau bằng khoá đang đóng thành một thanh cái điện, lập ma trận tổng dẫn Y-bus,
 * giải Y·V = I (nguồn Norton). Dòng qua từng khoá tính theo định luật Kirchhoff trên cây khoá.
 */
export class Network {
  readonly nNodes: number;
  readonly sws: Sw[] = [];
  readonly brs: Br[] = [];
  readonly srcs: Src[] = [];
  readonly shunt: Cx[];
  readonly v: Cx[];
  /** Thanh cái điện của từng nút sau khi gộp khoá */
  readonly busOf: Int32Array;
  /** Vùng liên thông (qua khoá đóng và nhánh đang làm việc) */
  readonly island: Int32Array;
  private _nBus = 0;
  private readonly parent: Int32Array;

  constructor(nNodes: number) {
    this.nNodes = nNodes;
    this.shunt = Array.from({ length: nNodes }, () => Cx.ZERO);
    this.v = Array.from({ length: nNodes }, () => Cx.ZERO);
    this.busOf = new Int32Array(nNodes);
    this.island = new Int32Array(nNodes);
    this.parent = new Int32Array(nNodes);
  }

  get nBus(): number {
    return this._nBus;
  }

  sw(name: string, a: number, b: number): Sw {
    const s = new Sw(name, a, b);
    this.sws.push(s);
    return s;
  }

  br(name: string, a: number, b: number, z: Cx): Br {
    const bItem = new Br(name, a, b, z);
    this.brs.push(bItem);
    return bItem;
  }

  src(node: number): Src {
    const s = new Src(node);
    this.srcs.push(s);
    return s;
  }

  private find(x: number): number {
    let r = x;
    while (this.parent[r] !== r) r = this.parent[r];
    let c = x;
    while (this.parent[c] !== r) {
      const n = this.parent[c];
      this.parent[c] = r;
      c = n;
    }
    return r;
  }

  private union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent[ra] = rb;
  }

  private buildBuses(): void {
    for (let i = 0; i < this.nNodes; i++) this.parent[i] = i;
    for (const s of this.sws) if (s.closed) this.union(s.a, s.b);
    const map = new Map<number, number>();
    for (let i = 0; i < this.nNodes; i++) {
      const root = this.find(i);
      let idx = map.get(root);
      if (idx === undefined) {
        idx = map.size;
        map.set(root, idx);
      }
      this.busOf[i] = idx;
    }
    this._nBus = map.size;
    // vùng liên thông
    for (let i = 0; i < this.nNodes; i++) this.parent[i] = i;
    for (const s of this.sws) if (s.closed) this.union(s.a, s.b);
    for (const b of this.brs) if (b.on) this.union(b.a, b.b);
    for (let i = 0; i < this.nNodes; i++) this.island[i] = this.find(i);
  }

  /** Lập Y-bus (có thể thay tổng trở nguồn để giải mạch thứ tự nghịch) */
  private ybus(srcY: (s: Src) => Cx): Cx[][] {
    const y: Cx[][] = Array.from({ length: this._nBus }, () =>
      Array.from({ length: this._nBus }, () => Cx.ZERO),
    );
    for (let i = 0; i < this.nNodes; i++) {
      const k = this.busOf[i];
      y[k][k] = y[k][k].plus(this.shunt[i]).plus(new Cx(1e-7, 0.0));
    }
    for (const b of this.brs) {
      if (b.on) {
        const p = this.busOf[b.a];
        const q = this.busOf[b.b];
        if (p === q) continue;
        const yy = b.z.inv();
        y[p][p] = y[p][p].plus(yy.scale(1.0 / (b.t * b.t)));
        y[q][q] = y[q][q].plus(yy);
        y[p][q] = y[p][q].minus(yy.scale(1.0 / b.t));
        y[q][p] = y[q][p].minus(yy.scale(1.0 / b.t));
      }
    }
    for (const s of this.srcs) {
      if (s.on) {
        const k = this.busOf[s.node];
        y[k][k] = y[k][k].plus(srcY(s));
      }
    }
    return y;
  }

  solve(): void {
    this.buildBuses();
    const y = this.ybus((it) => it.y);
    const rhs: Cx[] = Array.from({ length: this._nBus }, () => Cx.ZERO);
    for (const s of this.srcs) {
      if (s.on) {
        const k = this.busOf[s.node];
        rhs[k] = rhs[k].plus(s.inj);
      }
    }
    const vb = solveCx(y, rhs);
    for (let i = 0; i < this.nNodes; i++) this.v[i] = vb[this.busOf[i]];
    for (const b of this.brs) {
      b.ib =
        b.on && this.busOf[b.a] !== this.busOf[b.b]
          ? this.v[b.a].scale(1.0 / b.t).minus(this.v[b.b]).div(b.z)
          : Cx.ZERO;
      b.i = b.ib.scale(1.0 / b.t);
    }
    for (const s of this.srcs) {
      s.i = s.on ? s.inj.minus(s.y.times(this.v[s.node])) : Cx.ZERO;
    }
    this.switchCurrents();
  }

  /** Dòng ra khỏi nút vào các phần tử không phải khoá */
  private outflow(n: number): Cx {
    let o = this.shunt[n].times(this.v[n]);
    for (const b of this.brs) {
      if (b.on) {
        if (b.a === n) o = o.plus(b.i);
        else if (b.b === n) o = o.minus(b.ib);
      }
    }
    for (const s of this.srcs) {
      if (s.on && s.node === n) o = o.minus(s.i);
    }
    return o;
  }

  private switchCurrents(): void {
    for (const s of this.sws) s.i = Cx.ZERO;
    const adj: Sw[][] = Array.from({ length: this.nNodes }, () => []);
    for (const s of this.sws) {
      if (s.closed) {
        adj[s.a].push(s);
        adj[s.b].push(s);
      }
    }
    const seen = new Uint8Array(this.nNodes);
    const out: Cx[] = Array.from({ length: this.nNodes }, (_, i) => this.outflow(i));
    for (let root = 0; root < this.nNodes; root++) {
      if (seen[root]) continue;
      // DFS không đệ quy, xếp thứ tự để cộng dồn từ lá lên gốc
      const order: number[] = [];
      const par = new Map<number, Sw | null>();
      const stack: number[] = [root];
      seen[root] = 1;
      par.set(root, null);
      while (stack.length > 0) {
        const n = stack.pop()!;
        order.push(n);
        for (const s of adj[n]) {
          const m = s.a === n ? s.b : s.a;
          if (!seen[m]) {
            seen[m] = 1;
            par.set(m, s);
            stack.push(m);
          }
        }
      }
      const sub = new Map<number, Cx>();
      for (const n of order) sub.set(n, out[n]);
      for (let idx = order.length - 1; idx >= 0; idx--) {
        const n = order[idx];
        const s = par.get(n);
        if (!s) continue;
        const p = s.a === n ? s.b : s.a;
        const cur = sub.get(n)!;
        s.i = n === s.b ? cur : cur.neg(); // dòng chảy từ a sang b
        sub.set(p, sub.get(p)!.plus(cur));
      }
    }
  }

  /**
   * Tổng trở Thevenin tại nút (nguồn ngắn mạch, giữ tổng dẫn trong). srcY cho phép đổi tổng trở nguồn (thứ tự nghịch).
   * Gọi sau solve() để dùng cấu trúc thanh cái hiện tại.
   */
  thevenin(node: number, srcY: (s: Src) => Cx = (it) => it.y, extraShunt: Cx[] | null = null): Cx {
    const save = extraShunt !== null ? this.shunt.slice() : null;
    if (extraShunt !== null) {
      for (let i = 0; i < this.nNodes; i++) this.shunt[i] = extraShunt[i];
    }
    const y = this.ybus(srcY);
    if (save !== null) {
      for (let i = 0; i < this.nNodes; i++) this.shunt[i] = save[i];
    }
    const rhs: Cx[] = Array.from({ length: this._nBus }, () => Cx.ZERO);
    rhs[this.busOf[node]] = Cx.ONE;
    return solveCx(y, rhs)[this.busOf[node]];
  }

  /** Giải mạch thứ tự nghịch với dòng bơm tại nút sự cố, trả về điện áp từng nút */
  solveNeg(node: number, inj: Cx, srcY: (s: Src) => Cx, negShunt: Cx[]): Cx[] {
    const save = this.shunt.slice();
    for (let i = 0; i < this.nNodes; i++) this.shunt[i] = negShunt[i];
    const y = this.ybus(srcY);
    for (let i = 0; i < this.nNodes; i++) this.shunt[i] = save[i];
    const rhs: Cx[] = Array.from({ length: this._nBus }, () => Cx.ZERO);
    rhs[this.busOf[node]] = inj;
    const vb = solveCx(y, rhs);
    return Array.from({ length: this.nNodes }, (_, i) => vb[this.busOf[i]]);
  }
}
