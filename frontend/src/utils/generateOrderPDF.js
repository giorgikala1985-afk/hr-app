import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

function ensureGeorgianFont() {
  const id = 'georgian-font-link';
  if (!document.getElementById(id)) {
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+Georgian:wght@400;600;700&display=swap';
    document.head.appendChild(link);
  }
}

function fmt(val) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
}

export async function generateOrderPDF({ employee, type, direction, amount, date, month, companyName, orderNumber }) {
  ensureGeorgianFont();

  const isAddition = direction === 'addition';
  const accentColor = isAddition ? '#16a34a' : '#dc2626';
  const accentLight = isAddition ? '#f0fdf4' : '#fef2f2';

  const monthLabel = (() => {
    const [y, m] = month.split('-').map(Number);
    return new Date(y, m - 1).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  })();

  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const orderRef = `ORD-${month.replace('-', '')}-${String(orderNumber).padStart(4, '0')}`;
  const title = isAddition ? 'PAYMENT ORDER' : 'DEDUCTION ORDER';

  const empDetails = [
    employee.position && `Position: ${employee.position}`,
    employee.department && `Department: ${employee.department}`,
    employee.personal_id && `Personal ID: ${employee.personal_id}`,
  ].filter(Boolean).join('   ·   ');

  const noteText = isAddition
    ? `This order authorizes the addition of ${fmt(amount)} to the employee's net salary for the period of ${monthLabel}.`
    : `This order authorizes the deduction of ${fmt(amount)} from the employee's net salary for the period of ${monthLabel}.`;

  const FONT = `'Noto Sans Georgian', 'Sylfaen', 'Arial Unicode MS', Arial, sans-serif`;

  const html = `
<div id="order-pdf-root" style="
  width: 560px;
  background: #ffffff;
  font-family: ${FONT};
  color: #1e293b;
  position: relative;
  box-sizing: border-box;
">

  <!-- HEADER -->
  <div style="background: #0f3460; padding: 16px 24px 14px; display: flex; justify-content: space-between; align-items: flex-start;">
    <div>
      <div style="color: #ffffff; font-size: 14px; font-weight: 700; margin-bottom: 2px; font-family: ${FONT};">${companyName}</div>
      <div style="color: #a8c4e0; font-size: 9px; font-family: ${FONT};">Human Resources Department</div>
    </div>
    <div style="text-align: right;">
      <div style="color: #ffffff; font-size: 10px; font-weight: 700; font-family: ${FONT};">${orderRef}</div>
      <div style="color: #a8c4e0; font-size: 9px; margin-top: 2px; font-family: ${FONT};">Issued: ${today}</div>
    </div>
  </div>

  <!-- TITLE -->
  <div style="text-align: center; padding: 16px 24px 0;">
    <div style="font-size: 15px; font-weight: 700; color: #0f3460; letter-spacing: 1px; font-family: ${FONT};">${title}</div>
    <div style="height: 2px; width: 80px; background: ${accentColor}; margin: 6px auto 0; border-radius: 2px;"></div>
  </div>

  <!-- EMPLOYEE CARD -->
  <div style="margin: 14px 24px 0; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; display: flex; justify-content: space-between; align-items: flex-start;">
    <div>
      <div style="font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin-bottom: 4px; font-family: ${FONT};">EMPLOYEE</div>
      <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 2px; font-family: ${FONT};">${employee.first_name || ''} ${employee.last_name || ''}</div>
      ${empDetails ? `<div style="font-size: 9px; color: #64748b; font-family: ${FONT};">${empDetails}</div>` : ''}
    </div>
    <div style="text-align: right;">
      <div style="font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin-bottom: 4px; font-family: ${FONT};">PERIOD</div>
      <div style="font-size: 11px; font-weight: 700; color: #0f172a; font-family: ${FONT};">${monthLabel}</div>
    </div>
  </div>

  <!-- ORDER DETAILS -->
  <div style="margin: 12px 24px 0;">
    <div style="font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin-bottom: 5px; font-family: ${FONT};">ORDER DETAILS</div>
    <div style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
      ${[
        ['Order Reference', orderRef],
        ['Order Type', title],
        ['Unit Type', type],
        ['Direction', isAddition ? 'Addition to salary' : 'Deduction from salary'],
        ['Effective Date', date],
        ['Salary Period', monthLabel],
      ].map(([label, value], i) => `
        <div style="display: flex; justify-content: space-between; padding: 6px 12px; background: ${i % 2 === 0 ? '#f8fafc' : '#ffffff'}; border-bottom: ${i < 5 ? '1px solid #f1f5f9' : 'none'};">
          <span style="font-size: 10px; color: #64748b; font-family: ${FONT};">${label}</span>
          <span style="font-size: 10px; font-weight: 600; color: #1e293b; font-family: ${FONT};">${value}</span>
        </div>
      `).join('')}
    </div>
  </div>

  <!-- AMOUNT BOX -->
  <div style="margin: 12px 24px 0; background: ${accentColor}; border-radius: 8px; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center;">
    <div style="font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(255,255,255,0.85); font-family: ${FONT};">TOTAL AMOUNT</div>
    <div style="font-size: 18px; font-weight: 700; color: #ffffff; font-family: ${FONT};">${isAddition ? '+' : '-'} ${fmt(amount)}</div>
  </div>

  <!-- NOTE -->
  <div style="margin: 10px 24px 0; background: #fffbeb; border: 1px solid #fbbf24; border-radius: 6px; padding: 8px 12px;">
    <div style="font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #92400e; margin-bottom: 3px; font-family: ${FONT};">NOTE</div>
    <div style="font-size: 9px; color: #78350f; line-height: 1.5; font-family: ${FONT};">${noteText}</div>
  </div>

  <!-- SIGNATURES -->
  <div style="margin: 18px 24px 0; display: flex; gap: 14px;">
    ${['Prepared By', 'Approved By', 'Employee Signature'].map(label => `
      <div style="flex: 1; text-align: center;">
        <div style="height: 32px;"></div>
        <div style="border-top: 1.5px solid #94a3b8; padding-top: 5px;">
          <div style="font-size: 9px; font-weight: 600; color: #64748b; font-family: ${FONT};">${label}</div>
          <div style="font-size: 8px; color: #cbd5e1; margin-top: 1px; font-family: ${FONT};">Signature / Date</div>
        </div>
      </div>
    `).join('')}
  </div>

  <!-- FOOTER -->
  <div style="margin-top: 16px; padding: 10px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
    <div style="font-size: 8px; color: #94a3b8; font-family: ${FONT};">${companyName} · HR Department · ${orderRef} · Generated on ${today}</div>
  </div>

</div>`;

  // Mount hidden element
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;';
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);

  // Wait for fonts
  await document.fonts.ready;

  try {
    const el = wrapper.querySelector('#order-pdf-root');
    const canvas = await html2canvas(el, {
      scale: 1.5,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.85);
    const pdfW = 148; // A5 mm
    const pdfH = (canvas.height / canvas.width) * pdfW;

    const pdf = new jsPDF({ unit: 'mm', format: [pdfW, pdfH] });
    pdf.addImage(imgData, 'JPEG', 0, 0, pdfW, pdfH);
    pdf.save(`Order_${orderRef}_${(employee.last_name || 'Employee')}.pdf`);
  } finally {
    document.body.removeChild(wrapper);
  }
}
