export const shorthands = undefined;

export const up = (pgm) => {
  pgm.addColumns(
    'users',
    { email_verified: { type: 'boolean', notNull: true, default: false } },
    { ifNotExists: true },
  );

  // accounts that exist before verification was added are treated as verified
  pgm.sql('UPDATE users SET email_verified = true');
};

export const down = (pgm) => {
  pgm.dropColumns('users', ['email_verified'], { ifExists: true });
};
