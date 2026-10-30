export const shorthands = undefined;

export const up = (pgm) => {
  pgm.addColumn('services', {
    deposit_amount: { type: 'decimal(10,2)' },
  });

  pgm.sql('UPDATE services SET deposit_amount = 300');

  pgm.alterColumn('services', 'deposit_amount', { notNull: true });
  pgm.addConstraint('services', 'check_deposit_positive', {
    check: 'deposit_amount > 0',
  });

  pgm.dropColumn('payments', 'payment_type');

  pgm.sql(`
    COMMENT ON COLUMN services.deposit_amount IS 'Flat reservation deposit charged at booking. Set by admin per service.';
    COMMENT ON COLUMN payments.amount IS 'Estimated total from the booked variant. Replaced when staff change the variant or set a final price.';
    COMMENT ON COLUMN payments.amount_paid IS 'Deposit paid at booking. Not changed when the balance is settled at handover.';
    COMMENT ON COLUMN payments.remaining_balance IS 'Balance still owed after the deposit. 0 once settled at handover.';
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    COMMENT ON COLUMN payments.amount IS NULL;
    COMMENT ON COLUMN payments.amount_paid IS NULL;
    COMMENT ON COLUMN payments.remaining_balance IS NULL;
  `);

  pgm.addColumn('payments', {
    payment_type: { type: 'varchar(50)', default: 'full' },
  });

  pgm.dropColumn('services', 'deposit_amount');
};
