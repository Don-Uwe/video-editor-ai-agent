export type QueueItem = Record<string, unknown> | symbol;

export class AsyncQueue {
  private readonly items: QueueItem[] = [];
  private readonly waiters: Array<(value: QueueItem) => void> = [];

  putNowait(item: QueueItem): void {
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter(item);
      return;
    }
    this.items.push(item);
  }

  async get(): Promise<QueueItem> {
    const next = this.items.shift();
    if (next !== undefined) return next;
    return new Promise<QueueItem>((resolve) => {
      this.waiters.push(resolve);
    });
  }
}
