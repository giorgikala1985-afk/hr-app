const express = require('express');
const router = express.Router();
const multer = require('multer');
const pdfParse = require('pdf-parse');
const XLSX = require('xlsx');
const { Document, Packer, Paragraph, TextRun, HeadingLevel } = require('docx');
const OpenAI = require('openai');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 }, // 30 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed'));
  },
});

// POST /api/tools/pdf-convert?format=word|excel
router.post('/pdf-convert', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No PDF file uploaded' });

    const format = (req.query.format || 'word').toLowerCase();

    // Parse PDF
    const pdfData = await pdfParse(req.file.buffer);
    const rawText = pdfData.text || '';
    const pages = rawText.split(/\f/).map(p => p.trim()).filter(Boolean);

    if (format === 'excel') {
      const wb = XLSX.utils.book_new();

      pages.forEach((pageText, pageIdx) => {
        const lines = pageText.split('\n').map(l => l.trimEnd());
        // Try to detect table-like rows (split by 2+ spaces)
        const wsData = lines.map(line => {
          const cols = line.split(/\s{2,}/);
          return cols.length > 1 ? cols : [line];
        });
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        // Auto column widths
        const maxCols = Math.max(...wsData.map(r => r.length));
        ws['!cols'] = Array.from({ length: maxCols }, () => ({ wch: 30 }));
        XLSX.utils.book_append_sheet(wb, ws, `Page ${pageIdx + 1}`);
      });

      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      const originalName = req.file.originalname.replace(/\.pdf$/i, '');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(originalName)}.xlsx"`);
      return res.send(buf);
    }

    // Word output
    const children = [];
    pages.forEach((pageText, pageIdx) => {
      if (pageIdx > 0) {
        // Page break paragraph
        children.push(new Paragraph({ pageBreakBefore: true, children: [] }));
      }
      const lines = pageText.split('\n');
      lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) {
          children.push(new Paragraph({ children: [] }));
          return;
        }
        // Heuristic: short all-caps lines or lines shorter than 60 chars at start of page → heading
        const isHeading = trimmed.length < 80 && (trimmed === trimmed.toUpperCase() || /^\d+\./.test(trimmed));
        children.push(new Paragraph({
          heading: isHeading ? HeadingLevel.HEADING_2 : undefined,
          children: [new TextRun({ text: trimmed, size: 24, font: 'Calibri' })],
        }));
      });
    });

    const doc = new Document({
      sections: [{ properties: {}, children }],
    });

    const buf = await Packer.toBuffer(doc);
    const originalName = req.file.originalname.replace(/\.pdf$/i, '');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(originalName)}.docx"`);
    return res.send(buf);

  } catch (err) {
    console.error('PDF convert error:', err);
    res.status(500).json({ error: 'Failed to convert PDF: ' + (err.message || 'Unknown error') });
  }
});

// POST /api/tools/pdf-ask  — upload one or more PDFs + question, get answer across all
const uploadMulti = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed'));
  },
});

router.post('/pdf-ask', uploadMulti.array('files', 20), async (req, res) => {
  try {
    const files = req.files || [];
    if (files.length === 0) return res.status(400).json({ error: 'No PDF files uploaded' });
    const question = (req.body.question || '').trim();
    if (!question) return res.status(400).json({ error: 'Question is required' });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY is not configured on the server.' });

    // Extract text from all PDFs and combine with file name labels
    const charsPerFile = Math.floor(100000 / files.length);
    const combinedText = (
      await Promise.all(
        files.map(async (f) => {
          const pdfData = await pdfParse(f.buffer);
          const text = (pdfData.text || '').slice(0, charsPerFile);
          return `=== Document: ${f.originalname} ===\n${text}`;
        })
      )
    ).join('\n\n');

    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful assistant. Answer questions based only on the provided documents. If the answer comes from a specific document, mention its name.' },
        { role: 'user', content: `Documents:\n"""\n${combinedText}\n"""\n\nQuestion: ${question}` }
      ],
    });

    const answer = completion.choices[0].message.content;
    res.json({ answer });
  } catch (err) {
    console.error('PDF ask error:', err);
    res.status(500).json({ error: 'Failed to get answer: ' + (err.message || 'Unknown error') });
  }
});

module.exports = router;
