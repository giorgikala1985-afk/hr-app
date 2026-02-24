const express = require('express');
const router = express.Router();
const multer = require('multer');
const supabase = require('../config/supabase');
// Multer with memory storage for Supabase upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
    }
  }
});

// Upload photo to Supabase Storage and return public URL
async function uploadPhoto(file, userId) {
  const ext = file.originalname.split('.').pop();
  const fileName = `${userId}/${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;

  const { error } = await supabase.storage
    .from('employee-photos')
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
      upsert: false
    });

  if (error) throw error;

  const { data } = supabase.storage
    .from('employee-photos')
    .getPublicUrl(fileName);

  return { publicUrl: data.publicUrl, storagePath: fileName };
}

// Delete photo from Supabase Storage
async function deletePhoto(photoUrl) {
  if (!photoUrl) return;
  try {
    // Extract storage path from the public URL
    const bucketPath = photoUrl.split('/employee-photos/')[1];
    if (bucketPath) {
      await supabase.storage.from('employee-photos').remove([bucketPath]);
    }
  } catch (err) {
    console.error('Error deleting photo:', err);
  }
}

// GET /api/employees - list all
router.get('/', async (req, res) => {
  try {
    const { search } = req.query;

    let query = supabase
      .from('employees')
      .select('*')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,position.ilike.%${search}%,personal_id.ilike.%${search}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching employees:', error);
      return res.status(500).json({ error: 'Failed to fetch employees' });
    }

    res.json({ employees: data || [] });
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ error: 'An error occurred while fetching employees' });
  }
});

// POST /api/employees/import - bulk import from Excel
router.post('/import', async (req, res) => {
  try {
    const { employees } = req.body;

    if (!Array.isArray(employees) || employees.length === 0) {
      return res.status(400).json({ error: 'No employees data provided' });
    }

    const required = ['first_name', 'last_name', 'personal_id', 'birthdate', 'position', 'salary', 'overtime_rate', 'start_date'];
    const errors = [];
    const valid = [];

    employees.forEach((emp, index) => {
      const missing = required.filter((f) => !emp[f] && emp[f] !== 0);
      if (missing.length > 0) {
        errors.push({ row: index + 2, message: `Missing: ${missing.join(', ')}` });
      } else {
        valid.push({
          user_id: req.userId,
          first_name: String(emp.first_name).trim(),
          last_name: String(emp.last_name).trim(),
          personal_id: String(emp.personal_id).trim(),
          birthdate: emp.birthdate,
          position: String(emp.position).trim(),
          salary: parseFloat(emp.salary),
          overtime_rate: parseFloat(emp.overtime_rate),
          start_date: emp.start_date,
          end_date: emp.end_date || null,
          account_number: emp.account_number ? String(emp.account_number).trim() : null,
          photo_url: null
        });
      }
    });

    let imported = 0;
    if (valid.length > 0) {
      const { data, error } = await supabase
        .from('employees')
        .insert(valid)
        .select();

      if (error) {
        console.error('Bulk import error:', error);
        return res.status(500).json({ error: 'Database insert failed: ' + error.message });
      }
      imported = data.length;
    }

    res.json({ imported, errors, total: employees.length });
  } catch (error) {
    console.error('Import employees error:', error);
    res.status(500).json({ error: 'An error occurred during import' });
  }
});

// GET /api/employees/:id - get single
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.json({ employee: data });
  } catch (error) {
    console.error('Get employee error:', error);
    res.status(500).json({ error: 'An error occurred while fetching employee' });
  }
});

// POST /api/employees - create
router.post('/', upload.single('photo'), async (req, res) => {
  try {
    const { first_name, last_name, personal_id, birthdate, position, salary, overtime_rate, start_date, end_date, account_number, tax_code, pension } = req.body;

    // Validate required fields
    if (!first_name || !last_name || !personal_id || !birthdate || !position || !salary || !overtime_rate || !start_date) {
      return res.status(400).json({ error: 'All fields are required (end date is optional)' });
    }

    let photo_url = null;
    if (req.file) {
      const result = await uploadPhoto(req.file, req.userId);
      photo_url = result.publicUrl;
    }

    const { data, error } = await supabase
      .from('employees')
      .insert({
        user_id: req.userId,
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        personal_id: personal_id.trim(),
        birthdate,
        position: position.trim(),
        salary: parseFloat(salary),
        overtime_rate: parseFloat(overtime_rate),
        start_date,
        end_date: end_date || null,
        account_number: account_number ? account_number.trim() : null,
        tax_code: tax_code ? tax_code.trim() : null,
        pension: pension === 'true' || pension === true,
        photo_url
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating employee:', error);
      return res.status(500).json({ error: 'Failed to create employee' });
    }

    res.status(201).json({ message: 'Employee created successfully', employee: data });
  } catch (error) {
    console.error('Create employee error:', error);
    res.status(500).json({ error: 'An error occurred while creating employee' });
  }
});

// PUT /api/employees/:id - update
router.put('/:id', upload.single('photo'), async (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, personal_id, birthdate, position, salary, overtime_rate, start_date, end_date, account_number, tax_code, pension } = req.body;

    if (!first_name || !last_name || !personal_id || !birthdate || !position || !salary || !overtime_rate || !start_date) {
      return res.status(400).json({ error: 'All fields are required (end date is optional)' });
    }

    // Get existing employee
    const { data: existing } = await supabase
      .from('employees')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.userId)
      .single();

    if (!existing) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    let photo_url = existing.photo_url;

    // If new photo uploaded, replace old one
    if (req.file) {
      await deletePhoto(existing.photo_url);
      const result = await uploadPhoto(req.file, req.userId);
      photo_url = result.publicUrl;
    }

    const { data, error } = await supabase
      .from('employees')
      .update({
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        personal_id: personal_id.trim(),
        birthdate,
        position: position.trim(),
        salary: parseFloat(salary),
        overtime_rate: parseFloat(overtime_rate),
        start_date,
        end_date: end_date || null,
        account_number: account_number ? account_number.trim() : null,
        tax_code: tax_code ? tax_code.trim() : null,
        pension: pension === 'true' || pension === true,
        photo_url,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', req.userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating employee:', error);
      return res.status(500).json({ error: 'Failed to update employee' });
    }

    res.json({ message: 'Employee updated successfully', employee: data });
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({ error: 'An error occurred while updating employee' });
  }
});

// DELETE /api/employees/:id - delete
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get employee to find photo URL
    const { data: employee } = await supabase
      .from('employees')
      .select('id, photo_url')
      .eq('id', id)
      .eq('user_id', req.userId)
      .single();

    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Delete photo from storage
    await deletePhoto(employee.photo_url);

    // Delete all related documents from storage
    const { data: docs } = await supabase
      .from('employee_documents')
      .select('file_url')
      .eq('employee_id', id);

    if (docs) {
      for (const doc of docs) {
        const bucketPath = doc.file_url?.split('/employee-documents/')[1];
        if (bucketPath) {
          await supabase.storage.from('employee-documents').remove([bucketPath]);
        }
      }
    }

    // Delete all child records before deleting employee
    await Promise.all([
      supabase.from('salary_changes').delete().eq('employee_id', id),
      supabase.from('account_changes').delete().eq('employee_id', id),
      supabase.from('employee_documents').delete().eq('employee_id', id),
      supabase.from('employee_members').delete().eq('employee_id', id),
      supabase.from('employee_units').delete().eq('employee_id', id),
    ]);

    // Delete employee record
    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', id)
      .eq('user_id', req.userId);

    if (error) {
      console.error('Error deleting employee:', error);
      return res.status(500).json({ error: 'Failed to delete employee' });
    }

    res.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({ error: 'An error occurred while deleting employee' });
  }
});

// ===================== SALARY CHANGES =====================

// GET /api/employees/:id/salary-changes
router.get('/:id/salary-changes', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('salary_changes')
      .select('*')
      .eq('employee_id', req.params.id)
      .order('effective_date', { ascending: false });

    if (error) {
      console.error('Error fetching salary changes:', error);
      return res.status(500).json({ error: 'Failed to fetch salary changes' });
    }

    res.json({ salary_changes: data || [] });
  } catch (error) {
    console.error('Get salary changes error:', error);
    res.status(500).json({ error: 'An error occurred' });
  }
});

// POST /api/employees/:id/salary-changes
router.post('/:id/salary-changes', async (req, res) => {
  try {
    const { salary, overtime_rate, effective_date, note } = req.body;

    if (!salary || !effective_date) {
      return res.status(400).json({ error: 'Salary and effective date are required' });
    }

    // Verify employee belongs to user
    const { data: emp } = await supabase
      .from('employees')
      .select('id, salary, overtime_rate')
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .single();

    if (!emp) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Insert salary change record
    const { data, error } = await supabase
      .from('salary_changes')
      .insert({
        employee_id: req.params.id,
        old_salary: emp.salary,
        new_salary: parseFloat(salary),
        old_overtime_rate: emp.overtime_rate,
        new_overtime_rate: overtime_rate ? parseFloat(overtime_rate) : emp.overtime_rate,
        effective_date,
        note: note ? note.trim() : null
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating salary change:', error);
      return res.status(500).json({ error: 'Failed to create salary change' });
    }

    // Update the employee's current salary
    await supabase
      .from('employees')
      .update({
        salary: parseFloat(salary),
        overtime_rate: overtime_rate ? parseFloat(overtime_rate) : emp.overtime_rate,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .eq('user_id', req.userId);

    res.status(201).json({ message: 'Salary change recorded', salary_change: data });
  } catch (error) {
    console.error('Create salary change error:', error);
    res.status(500).json({ error: 'An error occurred' });
  }
});

// DELETE /api/employees/:id/salary-changes/:changeId
router.delete('/:id/salary-changes/:changeId', async (req, res) => {
  try {
    // Verify employee belongs to user
    const { data: emp } = await supabase
      .from('employees')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .single();

    if (!emp) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const { error } = await supabase
      .from('salary_changes')
      .delete()
      .eq('id', req.params.changeId)
      .eq('employee_id', req.params.id);

    if (error) {
      console.error('Error deleting salary change:', error);
      return res.status(500).json({ error: 'Failed to delete salary change' });
    }

    res.json({ message: 'Salary change deleted' });
  } catch (error) {
    console.error('Delete salary change error:', error);
    res.status(500).json({ error: 'An error occurred' });
  }
});

// ===================== ACCOUNT CHANGES =====================

// GET /api/employees/:id/account-changes
router.get('/:id/account-changes', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('account_changes')
      .select('*')
      .eq('employee_id', req.params.id)
      .order('effective_date', { ascending: false });

    if (error) {
      console.error('Error fetching account changes:', error);
      return res.status(500).json({ error: 'Failed to fetch account changes' });
    }

    res.json({ account_changes: data || [] });
  } catch (error) {
    console.error('Get account changes error:', error);
    res.status(500).json({ error: 'An error occurred' });
  }
});

// POST /api/employees/:id/account-changes
router.post('/:id/account-changes', async (req, res) => {
  try {
    const { account_number, effective_date, note } = req.body;

    if (!account_number || !effective_date) {
      return res.status(400).json({ error: 'Account number and effective date are required' });
    }

    // Verify employee belongs to user
    const { data: emp } = await supabase
      .from('employees')
      .select('id, account_number')
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .single();

    if (!emp) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Insert account change record
    const { data, error } = await supabase
      .from('account_changes')
      .insert({
        employee_id: req.params.id,
        old_account: emp.account_number || '',
        new_account: account_number.trim(),
        effective_date,
        note: note ? note.trim() : null
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating account change:', error);
      return res.status(500).json({ error: 'Failed to create account change' });
    }

    // Update the employee's current account number
    await supabase
      .from('employees')
      .update({
        account_number: account_number.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .eq('user_id', req.userId);

    res.status(201).json({ message: 'Account change recorded', account_change: data });
  } catch (error) {
    console.error('Create account change error:', error);
    res.status(500).json({ error: 'An error occurred' });
  }
});

// DELETE /api/employees/:id/account-changes/:changeId
router.delete('/:id/account-changes/:changeId', async (req, res) => {
  try {
    // Verify employee belongs to user
    const { data: emp } = await supabase
      .from('employees')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .single();

    if (!emp) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const { error } = await supabase
      .from('account_changes')
      .delete()
      .eq('id', req.params.changeId)
      .eq('employee_id', req.params.id);

    if (error) {
      console.error('Error deleting account change:', error);
      return res.status(500).json({ error: 'Failed to delete account change' });
    }

    res.json({ message: 'Account change deleted' });
  } catch (error) {
    console.error('Delete account change error:', error);
    res.status(500).json({ error: 'An error occurred' });
  }
});

// ===================== EMPLOYEE DOCUMENTS =====================

const docUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WebP, and PDF files are allowed'));
    }
  }
});

// GET /api/employees/:id/documents
router.get('/:id/documents', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('employee_documents')
      .select('*')
      .eq('employee_id', req.params.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching documents:', error);
      return res.status(500).json({ error: 'Failed to fetch documents' });
    }

    res.json({ documents: data || [] });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ error: 'An error occurred' });
  }
});

// POST /api/employees/:id/documents
router.post('/:id/documents', docUpload.single('file'), async (req, res) => {
  try {
    const { name } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'File is required' });
    }

    // Verify employee belongs to user
    const { data: emp } = await supabase
      .from('employees')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .single();

    if (!emp) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Upload to Supabase Storage
    const ext = req.file.originalname.split('.').pop();
    const fileName = `${req.userId}/${req.params.id}/${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('employee-documents')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from('employee-documents')
      .getPublicUrl(fileName);

    const { data, error } = await supabase
      .from('employee_documents')
      .insert({
        employee_id: req.params.id,
        name: (name || req.file.originalname).trim(),
        file_url: urlData.publicUrl,
        file_type: req.file.mimetype,
        file_size: req.file.size
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving document:', error);
      return res.status(500).json({ error: 'Failed to save document' });
    }

    res.status(201).json({ message: 'Document uploaded', document: data });
  } catch (error) {
    console.error('Upload document error:', error);
    res.status(500).json({ error: 'An error occurred while uploading document' });
  }
});

// DELETE /api/employees/:id/documents/:docId
router.delete('/:id/documents/:docId', async (req, res) => {
  try {
    // Verify employee belongs to user
    const { data: emp } = await supabase
      .from('employees')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .single();

    if (!emp) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Get document to find file URL
    const { data: doc } = await supabase
      .from('employee_documents')
      .select('*')
      .eq('id', req.params.docId)
      .eq('employee_id', req.params.id)
      .single();

    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Delete from storage
    const bucketPath = doc.file_url.split('/employee-documents/')[1];
    if (bucketPath) {
      await supabase.storage.from('employee-documents').remove([bucketPath]);
    }

    // Delete record
    const { error } = await supabase
      .from('employee_documents')
      .delete()
      .eq('id', req.params.docId);

    if (error) {
      console.error('Error deleting document:', error);
      return res.status(500).json({ error: 'Failed to delete document' });
    }

    res.json({ message: 'Document deleted' });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: 'An error occurred' });
  }
});

// ===================== EMPLOYEE MEMBERS =====================

// GET /api/employees/:id/members
router.get('/:id/members', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('employee_members')
      .select('*')
      .eq('employee_id', req.params.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching members:', error);
      return res.status(500).json({ error: 'Failed to fetch members' });
    }

    res.json({ members: data || [] });
  } catch (error) {
    console.error('Get members error:', error);
    res.status(500).json({ error: 'An error occurred' });
  }
});

// POST /api/employees/:id/members
router.post('/:id/members', async (req, res) => {
  try {
    const { type, custom_name, amount, effective_date } = req.body;

    if (!type || amount === undefined || amount === null || !effective_date) {
      return res.status(400).json({ error: 'Type, amount, and date are required' });
    }

    if (type === 'Custom' && !custom_name) {
      return res.status(400).json({ error: 'Custom name is required for custom type' });
    }

    // Verify employee belongs to user
    const { data: emp } = await supabase
      .from('employees')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .single();

    if (!emp) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const { data, error } = await supabase
      .from('employee_members')
      .insert({
        employee_id: req.params.id,
        type: type.trim(),
        custom_name: custom_name ? custom_name.trim() : null,
        amount: parseFloat(amount),
        effective_date
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating member:', error);
      return res.status(500).json({ error: 'Failed to create member' });
    }

    res.status(201).json({ message: 'Member added', member: data });
  } catch (error) {
    console.error('Create member error:', error);
    res.status(500).json({ error: 'An error occurred' });
  }
});

// POST /api/employees/:id/members/import - bulk import from Excel data
router.post('/:id/members/import', async (req, res) => {
  try {
    const { members } = req.body;

    if (!Array.isArray(members) || members.length === 0) {
      return res.status(400).json({ error: 'No members data provided' });
    }

    // Verify employee belongs to user
    const { data: emp } = await supabase
      .from('employees')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .single();

    if (!emp) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const errors = [];
    const valid = [];

    members.forEach((m, index) => {
      const missing = [];
      if (!m.type) missing.push('Type');
      if (m.amount === undefined || m.amount === null || m.amount === '') missing.push('Amount');
      if (!m.effective_date) missing.push('Date');
      if (m.type === 'Custom' && !m.custom_name) missing.push('Custom Name');

      if (missing.length > 0) {
        errors.push({ row: index + 2, message: `Missing: ${missing.join(', ')}` });
      } else {
        valid.push({
          employee_id: req.params.id,
          type: String(m.type).trim(),
          custom_name: m.custom_name ? String(m.custom_name).trim() : null,
          amount: parseFloat(m.amount),
          effective_date: m.effective_date,
        });
      }
    });

    let imported = 0;
    if (valid.length > 0) {
      const { data, error } = await supabase
        .from('employee_members')
        .insert(valid)
        .select();

      if (error) {
        console.error('Bulk member import error:', error);
        return res.status(500).json({ error: 'Database insert failed: ' + error.message });
      }
      imported = data.length;
    }

    res.json({ imported, errors, total: members.length });
  } catch (error) {
    console.error('Import members error:', error);
    res.status(500).json({ error: 'An error occurred during import' });
  }
});

// DELETE /api/employees/:id/members/:memberId
router.delete('/:id/members/:memberId', async (req, res) => {
  try {
    // Verify employee belongs to user
    const { data: emp } = await supabase
      .from('employees')
      .select('id')
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .single();

    if (!emp) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const { error } = await supabase
      .from('employee_members')
      .delete()
      .eq('id', req.params.memberId)
      .eq('employee_id', req.params.id);

    if (error) {
      console.error('Error deleting member:', error);
      return res.status(500).json({ error: 'Failed to delete member' });
    }

    res.json({ message: 'Member deleted' });
  } catch (error) {
    console.error('Delete member error:', error);
    res.status(500).json({ error: 'An error occurred' });
  }
});

// ==================== EMPLOYEE UNITS ====================

// GET units for employee
router.get('/:id/units', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('employee_units')
      .select('*')
      .eq('employee_id', req.params.id)
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ units: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create unit for employee
router.post('/:id/units', async (req, res) => {
  try {
    const { type, amount, date } = req.body;

    if (!type || amount === undefined || !date) {
      return res.status(400).json({ error: 'Type, amount, and date are required' });
    }

    const { data, error } = await supabase
      .from('employee_units')
      .insert({
        user_id: req.userId,
        employee_id: req.params.id,
        type,
        amount: parseFloat(amount),
        date,
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json({ unit: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE unit
router.delete('/:id/units/:unitId', async (req, res) => {
  try {
    const { error } = await supabase
      .from('employee_units')
      .delete()
      .eq('id', req.params.unitId)
      .eq('user_id', req.userId);

    if (error) throw error;
    res.json({ message: 'Unit deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
