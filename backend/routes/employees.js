const express = require('express');
const router = express.Router();
const multer = require('multer');
const supabase = require('../config/supabase');
const { authenticateUser } = require('../middleware/auth');

router.use(authenticateUser);

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
    const { first_name, last_name, personal_id, birthdate, position, salary, overtime_rate } = req.body;

    // Validate required fields
    if (!first_name || !last_name || !personal_id || !birthdate || !position || !salary || !overtime_rate) {
      return res.status(400).json({ error: 'All fields are required' });
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
    const { first_name, last_name, personal_id, birthdate, position, salary, overtime_rate } = req.body;

    if (!first_name || !last_name || !personal_id || !birthdate || !position || !salary || !overtime_rate) {
      return res.status(400).json({ error: 'All fields are required' });
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

module.exports = router;
