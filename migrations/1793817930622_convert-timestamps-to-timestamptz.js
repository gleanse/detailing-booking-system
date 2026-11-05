export const shorthands = undefined;

const columns = [
  ['users', 'created_at'],
  ['services', 'created_at'],
  ['service_variants', 'created_at'],
  ['availability', 'created_at'],
  ['closed_dates', 'created_at'],
  ['bookings', 'created_at'],
  ['bookings', 'updated_at'],
  ['bookings', 'expires_at'],
  ['payments', 'created_at'],
  ['payments', 'paid_at'],
  ['payments', 'refunded_at'],
  ['notifications', 'sent_at'],
  ['audit_logs', 'created_at'],
  ['booking_status_logs', 'created_at'],
];

export const up = (pgm) => {
  columns.forEach(([table, column]) => {
    pgm.alterColumn(table, column, {
      type: 'timestamptz',
      using: `${column}::timestamptz`,
    });
  });
};

export const down = (pgm) => {
  columns.forEach(([table, column]) => {
    pgm.alterColumn(table, column, {
      type: 'timestamp',
      using: `${column}::timestamp`,
    });
  });
};
