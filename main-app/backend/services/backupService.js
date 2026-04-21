const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { query } = require('../config/database');

const BACKUP_DIR = path.join(__dirname, '..', 'backups');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

function getTimestamp() {
  const now = new Date();
  return now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') + '_' +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0');
}

async function createBackup(userId, type = 'manual') {
  const filename = `abyte_pos_backup_${getTimestamp()}.sql`;
  const filepath = path.join(BACKUP_DIR, filename);

  const dbHost = process.env.DB_HOST || 'localhost';
  const dbPort = process.env.DB_PORT || '3306';
  const dbUser = process.env.DB_USER || 'root';
  const dbPass = process.env.DB_PASSWORD || '';
  const dbName = process.env.DB_NAME || 'abyte_pos';

  const dumpPath = process.env.MARIADB_DUMP_PATH || 'mariadb-dump';
  const passArg = dbPass ? `-p"${dbPass}"` : '';

  const cmd = `"${dumpPath}" -h ${dbHost} -P ${dbPort} -u ${dbUser} ${passArg} ${dbName} > "${filepath}"`;

  return new Promise((resolve, reject) => {
    exec(cmd, { shell: true }, async (error) => {
      if (error) {
        // Try mysqldump as fallback
        const fallbackCmd = `mysqldump -h ${dbHost} -P ${dbPort} -u ${dbUser} ${passArg} ${dbName} > "${filepath}"`;
        exec(fallbackCmd, { shell: true }, async (err2) => {
          if (err2) {
            try {
              await query(
                'INSERT INTO backups (filename, file_size, created_by, type, status) VALUES (?, 0, ?, ?, ?)',
                [filename, userId, type, 'failed']
              );
            } catch (dbErr) {
              console.error('Failed to log backup failure:', dbErr);
            }
            return reject(new Error('Backup failed. Ensure mariadb-dump or mysqldump is available in PATH.'));
          }
          await finishBackup(filename, filepath, userId, type);
          resolve({ filename, filepath });
        });
        return;
      }
      await finishBackup(filename, filepath, userId, type);
      resolve({ filename, filepath });
    });
  });
}

async function finishBackup(filename, filepath, userId, type) {
  const stats = fs.statSync(filepath);
  await query(
    'INSERT INTO backups (filename, file_size, created_by, type, status) VALUES (?, ?, ?, ?, ?)',
    [filename, stats.size, userId, type, 'completed']
  );
}

async function restoreBackup(filename) {
  const filepath = path.join(BACKUP_DIR, filename);

  if (!fs.existsSync(filepath)) {
    throw new Error('Backup file not found');
  }

  // Validate filename to prevent path traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw new Error('Invalid filename');
  }

  const dbHost = process.env.DB_HOST || 'localhost';
  const dbPort = process.env.DB_PORT || '3306';
  const dbUser = process.env.DB_USER || 'root';
  const dbPass = process.env.DB_PASSWORD || '';
  const dbName = process.env.DB_NAME || 'abyte_pos';

  const passArg = dbPass ? `-p"${dbPass}"` : '';
  const cmd = `mysql -h ${dbHost} -P ${dbPort} -u ${dbUser} ${passArg} ${dbName} < "${filepath}"`;

  return new Promise((resolve, reject) => {
    exec(cmd, { shell: true }, (error) => {
      if (error) {
        // Try mariadb client as fallback
        const fallbackCmd = `mariadb -h ${dbHost} -P ${dbPort} -u ${dbUser} ${passArg} ${dbName} < "${filepath}"`;
        exec(fallbackCmd, { shell: true }, (err2) => {
          if (err2) {
            return reject(new Error('Restore failed. Ensure mysql or mariadb client is available.'));
          }
          resolve();
        });
        return;
      }
      resolve();
    });
  });
}

function listBackupFiles() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.sql'))
    .map(f => {
      const stats = fs.statSync(path.join(BACKUP_DIR, f));
      return { filename: f, size: stats.size, created: stats.mtime };
    })
    .sort((a, b) => b.created - a.created);
}

function deleteBackupFile(filename) {
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw new Error('Invalid filename');
  }
  const filepath = path.join(BACKUP_DIR, filename);
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
  }
}

function getBackupDir() {
  return BACKUP_DIR;
}

module.exports = { createBackup, restoreBackup, listBackupFiles, deleteBackupFile, getBackupDir };
