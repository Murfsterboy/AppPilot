// Promise-based messaging with a Web Worker.
export class WorkerRPC {
  constructor(url) {
    this.url = url;
    this.worker = new Worker(url);
    this.seq = 0;
    this.pending = new Map();
    this.worker.onmessage = (ev) => {
      const { id, ok, result, error, progress } = ev.data;
      const p = this.pending.get(id);
      if (!p) return;
      if (progress !== undefined) { p.onProgress && p.onProgress(progress); return; }
      this.pending.delete(id);
      ok ? p.resolve(result) : p.reject(new Error(error));
    };
    this.worker.onerror = (e) => {
      for (const p of this.pending.values()) p.reject(new Error(e.message || "Worker crashed"));
      this.pending.clear();
    };
  }
  call(cmd, args, transfer = [], onProgress) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, onProgress });
      this.worker.postMessage({ id, cmd, args }, transfer);
    });
  }
  restart() {
    this.worker.terminate();
    for (const p of this.pending.values()) p.reject(new Error("Cancelled"));
    this.pending.clear();
    this.worker = new Worker(this.url);
    const w = this.worker;
    w.onmessage = (ev) => {
      const { id, ok, result, error, progress } = ev.data;
      const p = this.pending.get(id);
      if (!p) return;
      if (progress !== undefined) { p.onProgress && p.onProgress(progress); return; }
      this.pending.delete(id);
      ok ? p.resolve(result) : p.reject(new Error(error));
    };
  }
}
