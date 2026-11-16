import { FastifyPluginAsync } from 'fastify';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';
import { ValidationError, NotFoundError } from '../http/errors.js';
import { pool } from '../db/pool.js';
import { assertAdminKey } from '../auth/admin-key.js';

const admin = createClient(config.supabase.url, config.supabase.serviceRoleKey);

interface CreateUserBody {
  email: string;
  password: string;
  nama: string;
  role: 'ahli-gizi' | 'perawat' | 'waiter' | 'logistik' | 'dapur';
  telepon?: string;
}

interface UpdateUserBody {
  email?: string;
  password?: string;
  nama?: string;
  role?: 'ahli-gizi' | 'perawat' | 'waiter' | 'logistik' | 'dapur';
  telepon?: string;
}

const adminRoutes: FastifyPluginAsync = async (fastify) => {
  // Get all users
  fastify.get('/users', async (request, reply) => {
    assertAdminKey(request, 'melihat daftar pengguna');
    try {
      const result = await pool.query(`
        SELECT p.id, p.nama, p.role, p.telepon, p.aktif, p.foto_profil, u.email
        FROM profiles p
        LEFT JOIN auth.users u ON u.id = p.id
        ORDER BY p.created_at DESC
      `);

      return { users: result.rows };
    } catch (error) {
      fastify.log.error(error);
      throw new Error('Gagal memuat daftar pengguna');
    }
  });

  // Create new user
  fastify.post<{ Body: CreateUserBody }>('/users', async (request, reply) => {
    assertAdminKey(request, 'membuat pengguna');
    const { email, password, nama, role, telepon } = request.body;

    // Validation
    if (!email || !password || !nama || !role) {
      throw new ValidationError('Email, password, nama, dan role wajib diisi');
    }

    if (password.length < 8) {
      throw new ValidationError('Password minimal 8 karakter');
    }

    if (!['ahli-gizi', 'perawat', 'waiter', 'logistik', 'dapur'].includes(role)) {
      throw new ValidationError('Role tidak valid');
    }

    try {
      // Create user in Supabase Auth
      const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (authError || !authData.user) {
        // Re-throw as ValidationError with proper status code
        const message = authError?.message || 'Gagal membuat user di Auth';
        throw { statusCode: 422, code: 'VALIDATION', message };
      }

      // Create profile in database with unique username handling
      // Username dibuat dari email untuk kemudahan, tapi harus unique
      // Jika collision, tambahkan timestamp untuk uniqueness
      const baseUsername = email.split('@')[0];
      const timestamp = Date.now().toString().slice(-4);
      const username = `${baseUsername}_${timestamp}`;
      
      await pool.query(
        `INSERT INTO profiles (id, username, nama, role, telepon, aktif)
         VALUES ($1, $2, $3, $4, $5, true)`,
        [authData.user.id, username, nama, role, telepon || '']
      );

      return {
        success: true,
        message: 'Pengguna berhasil dibuat',
        user: {
          id: authData.user.id,
          email,
          username,
          nama,
          role,
          telepon,
        },
      };
    } catch (error: any) {
      fastify.log.error(error);
      
      // Handle validation errors with proper status code
      if (error.statusCode === 422 || error.code === 'VALIDATION') {
        return reply.status(422).send({
          success: false,
          error: error.message || 'Validasi gagal',
        });
      }
      
      if (error.code === '23514') {
        // Check constraint violation (e.g., invalid role)
        return reply.status(422).send({
          success: false,
          error: 'Role tidak valid. Pilih salah satu: Ahli Gizi, Perawat, Waiter, Logistik, atau Dapur',
        });
      }
      
      if (error.code === '23505') {
        if (error.constraint?.includes('username')) {
          return reply.status(422).send({
            success: false,
            error: 'Username sudah digunakan',
          });
        }
        return reply.status(422).send({
          success: false,
          error: 'Email sudah terdaftar',
        });
      }
      
      return reply.status(500).send({
        success: false,
        error: error.message || 'Gagal membuat pengguna',
      });
    }
  });

  // Update user
  fastify.put<{ Params: { id: string }; Body: UpdateUserBody }>(
    '/users/:id',
    async (request, reply) => {
      assertAdminKey(request, 'mengubah pengguna');
      const { id } = request.params;
      const { email, password, nama, role, telepon } = request.body;

      if (!nama || !role) {
        throw new ValidationError('Nama dan role wajib diisi');
      }

      if (!['ahli-gizi', 'perawat', 'waiter', 'logistik', 'dapur'].includes(role)) {
        throw new ValidationError('Role tidak valid');
      }

      if (password && password.length < 8) {
        throw new ValidationError('Password minimal 8 karakter');
      }

      try {
        // Update email and/or password in Supabase Auth
        const updateData: any = {};
        if (email) updateData.email = email;
        if (password) updateData.password = password;

        if (Object.keys(updateData).length > 0) {
          const { error: authError } = await admin.auth.admin.updateUserById(id, updateData);
          if (authError) {
            throw new ValidationError(authError.message);
          }
        }

        // Update profile in database
        const result = await pool.query(
          `UPDATE profiles 
           SET nama = $1, role = $2, telepon = $3, updated_at = NOW()
           WHERE id = $4
           RETURNING id, nama, role, telepon`,
          [nama, role, telepon || '', id]
        );

        if (result.rowCount === 0) {
          throw new NotFoundError('Pengguna tidak ditemukan');
        }

        return {
          success: true,
          message: 'Pengguna berhasil diupdate',
          user: result.rows[0],
        };
      } catch (error: any) {
        fastify.log.error(error);
        throw new Error(error.message || 'Gagal mengupdate pengguna');
      }
    }
  );

  // Delete user
  fastify.delete<{ Params: { id: string } }>('/users/:id', async (request, reply) => {
    assertAdminKey(request, 'menghapus pengguna');
    const { id } = request.params;

    try {
      // Delete from Supabase Auth
      const { error: authError } = await admin.auth.admin.deleteUser(id);
      if (authError) {
        throw new Error(authError.message);
      }

      // Delete profile from database (cascade should handle this, but we'll be explicit)
      await pool.query('DELETE FROM profiles WHERE id = $1', [id]);

      return {
        success: true,
        message: 'Pengguna berhasil dihapus',
      };
    } catch (error: any) {
      fastify.log.error(error);
      throw new Error(error.message || 'Gagal menghapus pengguna');
    }
  });

  // Seed default users (helper endpoint)
  fastify.post('/users/seed', async (request, reply) => {
    // Pembuat akun demo: hanya untuk pengembangan, tidak boleh ada di produksi.
    if (config.node_env === 'production') {
      throw new NotFoundError('Endpoint tidak tersedia.');
    }
    assertAdminKey(request, 'menjalankan seed pengguna');
    const defaultUsers = [
      { email: 'ahligizi1@nutricare.com', nama: 'Dr. Sarah Nutritionist', role: 'ahli-gizi' },
      { email: 'ahligizi2@nutricare.com', nama: 'Dr. Budi Gizi', role: 'ahli-gizi' },
      { email: 'perawat1@nutricare.com', nama: 'Siti Perawat', role: 'perawat' },
      { email: 'perawat2@nutricare.com', nama: 'Ani Ruangan', role: 'perawat' },
      { email: 'waiter1@nutricare.com', nama: 'Joko Distribusi', role: 'waiter' },
      { email: 'waiter2@nutricare.com', nama: 'Rina Antar', role: 'waiter' },
      { email: 'logistik1@nutricare.com', nama: 'Rudi Gudang', role: 'logistik' },
      { email: 'logistik2@nutricare.com', nama: 'Dewi Persediaan', role: 'logistik' },
    ];

    const results = [];
    const errors = [];

    for (const user of defaultUsers) {
      // Password acak per akun; tidak ada kata sandi yang tertulis di kode.
      const password = randomBytes(12).toString('base64url');
      try {
        const { data: authData, error: authError } = await admin.auth.admin.createUser({
          email: user.email,
          password,
          email_confirm: true,
        });

        if (authError || !authData.user) {
          errors.push({ email: user.email, error: authError?.message });
          continue;
        }

        await pool.query(
          `INSERT INTO profiles (id, username, nama, role, telepon, aktif)
           VALUES ($1, $2, $3, $4, $5, true)`,
          [authData.user.id, user.email.split('@')[0], user.nama, user.role, '']
        );

        results.push({ email: user.email, password, status: 'success' });
      } catch (error: any) {
        errors.push({ email: user.email, error: error.message });
      }
    }

    return {
      success: true,
      message: `Seeded ${results.length} users`,
      results,
      errors,
    };
  });
};

export default adminRoutes;
