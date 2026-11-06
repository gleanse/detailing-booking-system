const getNextQueueNumber = async (db, availabilityId) => {
  // no status filter on purpose so numbers are never reused after a cancel
  const result = await db.query(
    `SELECT COALESCE(MAX(queue_number), 0) + 1 AS next_queue
     FROM bookings
     WHERE availability_id = $1`,
    [availabilityId],
  );
  return result.rows[0].next_queue;
};

module.exports = { getNextQueueNumber };
