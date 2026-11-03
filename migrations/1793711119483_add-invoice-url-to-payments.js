export const shorthands = undefined;

export const up = (pgm) => {
  pgm.addColumns(
    'payments',
    { invoice_url: { type: 'text' } },
    { ifNotExists: true },
  );
};

export const down = (pgm) => {
  pgm.dropColumns('payments', ['invoice_url'], { ifExists: true });
};
