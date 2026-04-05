export interface State {
  name: string;
  enter?(): void;
  exit?(): void;
  update?(delta: number): void;
}

export class StateMachine {
  private states = new Map<string, State>();
  private _current: State | null = null;

  get currentName(): string {
    return this._current?.name ?? '';
  }

  addState(state: State): this {
    this.states.set(state.name, state);
    return this;
  }

  transition(name: string): void {
    if (this._current?.name === name) return;
    const next = this.states.get(name);
    if (!next) {
      console.warn(`StateMachine: state "${name}" not found`);
      return;
    }
    this._current?.exit?.();
    this._current = next;
    this._current.enter?.();
  }

  update(delta: number): void {
    this._current?.update?.(delta);
  }
}
