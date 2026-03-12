const pool = require('../config/db');

const getAllUsers = async () => {
  const query = 'SELECT id, name, email, created_at FROM users ORDER BY id ASC';
  const { rows } = await pool.query(query);
  return rows;
};

const getUserById = async (id) => {
  const query = 'SELECT id, name, email, created_at FROM users WHERE id = $1';
  const { rows } = await pool.query(query, [id]);
  return rows[0] || null;
};

const createUser = async (name, email) => {
  const query = `
    INSERT INTO users (name, email)
    VALUES ($1, $2)
    RETURNING id, name, email, created_at
  `;
  const { rows } = await pool.query(query, [name, email]);
  return rows[0];
};

const updateUser = async (id, name, email) => {
  const query = `
    UPDATE users
    SET name = $1, email = $2
    WHERE id = $3
    RETURNING id, name, email, created_at
  `;
  const { rows } = await pool.query(query, [name, email, id]);
  return rows[0] || null;
};

const deleteUser = async (id) => {
  const query = 'DELETE FROM users WHERE id = $1 RETURNING id, name, email, created_at';
  const { rows } = await pool.query(query, [id]);
  return rows[0] || null;
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser
};
