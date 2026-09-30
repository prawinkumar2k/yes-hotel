import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/yes-hotels';

async function generateMatrix() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;

  const roles = await db.collection('roles').find({}).sort({ key: 1 }).toArray();
  const pages = await db.collection('pageresources').find({}).sort({ module: 1, sortOrder: 1, key: 1 }).toArray();
  const perms = await db.collection('rolepermissions').find({}).toArray();

  let md = '# Role Permission Matrix\n\n';

  for (const role of roles) {
    if (role.key === 'SUPER_ADMIN') continue; // Super admin has full access

    md += `## ${role.name} (${role.key})\n\n`;
    md += `| Module | Page | VIEW | CREATE | EDIT | DELETE | APPROVE | REJECT | EXPORT | PRINT | SPECIAL ACTIONS |\n`;
    md += `|--------|------|------|--------|------|--------|---------|--------|--------|-------|-----------------|\n`;

    for (const page of pages) {
      const rolePerm = perms.find(p => p.roleId.toString() === role._id.toString() && p.pageKey === page.key);
      if (!rolePerm || rolePerm.actions.length === 0) continue; // Skip pages this role has no access to

      const actions = rolePerm.actions;
      
      const hasView = actions.includes('VIEW') ? '✓' : '✗';
      const hasCreate = actions.includes('CREATE') ? '✓' : '✗';
      const hasEdit = actions.includes('EDIT') ? '✓' : '✗';
      const hasDelete = actions.includes('DELETE') ? '✓' : '✗';
      const hasApprove = actions.includes('APPROVE') ? '✓' : '✗';
      const hasReject = actions.includes('REJECT') ? '✓' : '✗';
      const hasExport = actions.includes('EXPORT') ? '✓' : '✗';
      const hasPrint = actions.includes('PRINT') ? '✓' : '✗';

      const specialActions = actions.filter(a => !['VIEW', 'CREATE', 'EDIT', 'DELETE', 'APPROVE', 'REJECT', 'EXPORT', 'PRINT'].includes(a)).join(', ');

      md += `| ${page.module} | ${page.name} | ${hasView} | ${hasCreate} | ${hasEdit} | ${hasDelete} | ${hasApprove} | ${hasReject} | ${hasExport} | ${hasPrint} | ${specialActions} |\n`;
    }
    md += '\n';
  }

  fs.writeFileSync('c:/Users/Hp/Downloads/yes-hotels-booking-b40/docs/ROLE_PERMISSION_MATRIX.md', md);
  console.log('Matrix generated');
  process.exit(0);
}

generateMatrix().catch(console.error);
