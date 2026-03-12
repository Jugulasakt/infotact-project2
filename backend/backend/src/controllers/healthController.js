const pool = require('../config/db');

const healthCheck = async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS now');

    return res.status(200).json({
      success: true,
      message: 'API is running',
      databaseTime: result.rows[0].now,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: error.message,
    });
  }
};

module.exports = {
  healthCheck,
};
