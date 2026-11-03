export const shorthands = undefined;

export const up = (pgm) => {
  pgm.addColumns(
    'payments',
    {
      refunded_at: { type: 'timestamp' },
      refunded_by: { type: 'uuid', references: 'users' },
    },
    { ifNotExists: true },
  );
};

export const down = (pgm) => {
  pgm.dropColumns('payments', ['refunded_at', 'refunded_by'], { ifExists: true });
};