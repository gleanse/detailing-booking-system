export const shorthands = undefined;

export const up = (pgm) => {
  pgm.addColumns(
    'users',
    {
      active_session_id: { type: 'text' },
      active_session_expires: { type: 'timestamptz' },
    },
    { ifNotExists: true },
  );
};

export const down = (pgm) => {
  pgm.dropColumns(
    'users',
    ['active_session_id', 'active_session_expires'],
    { ifExists: true },
  );
};