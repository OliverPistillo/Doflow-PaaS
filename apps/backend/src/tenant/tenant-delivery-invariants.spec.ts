import { hasDirectedCycle } from './tenant-delivery-invariants';

describe('Delivery Core dependency invariants', () => {
  it('accepts an acyclic task plan', () => {
    expect(hasDirectedCycle(['brief', 'build', 'qa'], [
      { from: 'brief', to: 'build' },
      { from: 'build', to: 'qa' },
    ])).toBe(false);
  });

  it.each([
    [[{ from: 'brief', to: 'brief' }], 'self-reference'],
    [[{ from: 'brief', to: 'build' }, { from: 'build', to: 'brief' }], 'direct cycle'],
    [[{ from: 'brief', to: 'build' }, { from: 'build', to: 'qa' }, { from: 'qa', to: 'brief' }], 'indirect cycle'],
    [[{ from: 'unknown', to: 'brief' }], 'unknown task'],
  ])('rejects %s (%s)', (edges) => {
    expect(hasDirectedCycle(['brief', 'build', 'qa'], edges)).toBe(true);
  });
});
