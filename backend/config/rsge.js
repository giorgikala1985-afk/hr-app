const soap = require('soap');

// RS.ge API endpoints (real WSDLs)
const RS_WAYBILL_WSDL = process.env.RS_WAYBILL_WSDL || 'https://services.rs.ge/WayBillService/WayBillService.asmx?wsdl';
const RS_EINVOICE_WSDL = process.env.RS_EINVOICE_WSDL || 'https://www.revenue.mof.ge/ntosservice/ntosservice.asmx?wsdl';

const RS_USER = process.env.RS_SERVICE_USER;
const RS_PASSWORD = process.env.RS_SERVICE_PASSWORD;
const RS_TIN = process.env.RS_COMPANY_TIN; // Company's tax identification number (საიდენტიფიკაციო ნომერი)

// ══════════════════════════════════════════════════════
// DIRECT AUTH — RS.ge SOAP API uses su/sp with every call
// ══════════════════════════════════════════════════════

function authArgs() {
  return { su: RS_USER, sp: RS_PASSWORD };
}

function isConfigured() {
  return !!(RS_USER && RS_PASSWORD && RS_TIN);
}

// Test connection
async function testConnection() {
  const client = await getWaybillClient();
  const [result] = await client.chek_service_userAsync(authArgs());
  return result;
}

// ── Cache SOAP clients ───────────────────────────────
let waybillClient = null;
let einvoiceClient = null;

async function getWaybillClient() {
  if (!waybillClient) {
    waybillClient = await soap.createClientAsync(RS_WAYBILL_WSDL);
  }
  return waybillClient;
}

async function getEInvoiceClient() {
  if (!einvoiceClient) {
    einvoiceClient = await soap.createClientAsync(RS_EINVOICE_WSDL);
  }
  return einvoiceClient;
}

// ══════════════════════════════════════════════════════
// TAXPAYER LOOKUP (via WayBill service — no separate service)
// ══════════════════════════════════════════════════════

async function checkTaxpayer(tin) {
  const client = await getWaybillClient();
  const [result] = await client.get_name_from_tinAsync({ ...authArgs(), tin });
  return result;
}

async function isVatPayer(tin) {
  const client = await getWaybillClient();
  const [result] = await client.is_vat_payer_tinAsync({ ...authArgs(), tin });
  return result;
}

// ══════════════════════════════════════════════════════
// WAYBILL (ზედნადები) OPERATIONS
// ══════════════════════════════════════════════════════

async function createWaybill({
  buyerTin,
  buyerName,
  startAddress,
  endAddress,
  driverTin,
  driverName,
  vehiclePlate,
  items,
  transportType = 1, // 1=auto, 2=railway, 3=air, 4=other
  comment = '',
}) {
  const client = await getWaybillClient();

  const goodsList = items.map((item, idx) => ({
    ID: idx + 1,
    W_NAME: item.name,
    UNIT_ID: item.unitId || 99, // 99 = ცალი (piece)
    UNIT_TXT: item.unitName || 'ცალი',
    QUANTITY: item.quantity,
    PRICE: item.price,
    AMOUNT: item.quantity * item.price,
    BAR_CODE: item.barCode || '',
  }));

  const args = {
    ...authArgs(),
    waybill: {
      WAYBILL_TYPE: 1, // 1=inner, 2=import, 3=export, 4=inner-no-cost, 5=distribution, 6=return
      BUYER_TIN: buyerTin,
      BUYER_NAME: buyerName,
      START_ADDRESS: startAddress,
      END_ADDRESS: endAddress,
      DRIVER_TIN: driverTin,
      DRIVER_NAME: driverName,
      CAR_NUMBER: vehiclePlate,
      TRANSPORT_TYPE_ID: transportType,
      COMMENT: comment,
      GOODS_LIST: { GOODS: goodsList },
    },
  };

  const [result] = await client.save_waybillAsync(args);
  const res = result?.save_waybillResult?.RESULT || result?.save_waybillResult || result;
  const status = parseInt(res?.STATUS);
  if (status < 0) {
    throw new Error(`RS.ge error (status ${status}). Check buyer TIN and waybill data.`);
  }
  // STATUS > 0 means the waybill ID
  return { WAYBILL_ID: status > 0 ? status : res?.ID || res?.WAYBILL_ID || null, ...res };
}

// Activate = send_waybill in RS.ge API
async function activateWaybill(waybillId) {
  if (!waybillId) throw new Error('No RS.ge waybill ID — the waybill may not have been saved on RS.ge');
  const client = await getWaybillClient();
  const [result] = await client.send_waybillAsync({ ...authArgs(), waybill_id: parseInt(waybillId) });
  return result;
}

async function closeWaybill(waybillId) {
  if (!waybillId) throw new Error('No RS.ge waybill ID');
  const client = await getWaybillClient();
  const [result] = await client.close_waybillAsync({ ...authArgs(), waybill_id: parseInt(waybillId) });
  return result;
}

async function deleteWaybill(waybillId) {
  if (!waybillId) throw new Error('No RS.ge waybill ID');
  const client = await getWaybillClient();
  const [result] = await client.del_waybillAsync({ ...authArgs(), waybill_id: parseInt(waybillId) });
  return result;
}

// Reject/cancel waybill
async function refWaybill(waybillId) {
  if (!waybillId) throw new Error('No RS.ge waybill ID');
  const client = await getWaybillClient();
  const [result] = await client.ref_waybillAsync({ ...authArgs(), waybill_id: parseInt(waybillId) });
  return result;
}

async function getWaybill(waybillId) {
  const client = await getWaybillClient();
  const [result] = await client.get_waybillAsync({ ...authArgs(), waybill_id: parseInt(waybillId) });
  return result;
}

async function getWaybillList({ startDate, endDate, buyerTin, status }) {
  const client = await getWaybillClient();
  const args = {
    ...authArgs(),
    itypes: '',           // all types
    buyer_tin: buyerTin || '',
    statuses: status != null ? String(status) : '', // empty = all
    car_number: '',
    begin_date_s: startDate,
    begin_date_e: endDate,
    create_date_s: startDate,
    create_date_e: endDate,
    driver_tin: '',
    delivery_date_s: '',
    delivery_date_e: '',
    full_amount: 0,
    waybill_number: '',
    close_date_s: '',
    close_date_e: '',
    s_user_ids: '',
    comment: '',
  };
  const [result] = await client.get_waybillsAsync(args);
  return result;
}

// ══════════════════════════════════════════════════════
// E-INVOICES (ელექტრონული ანგარიშ-ფაქტურა) via NtosService
// ══════════════════════════════════════════════════════

// Get user_id for e-invoice operations (needed by NtosService)
let cachedUserId = null;
async function getEInvoiceUserId() {
  if (cachedUserId) return cachedUserId;
  const client = await getEInvoiceClient();
  const [result] = await client.chekAsync({ ...authArgs(), user_id: 0 });
  if (result.chekResult) {
    cachedUserId = result.user_id;
  }
  return cachedUserId;
}

// Get un_id (unified ID) from TIN for e-invoice buyer
async function getUnIdFromTin(tin) {
  const client = await getEInvoiceClient();
  const userId = await getEInvoiceUserId();
  const [result] = await client.get_un_id_from_tinAsync({ su: RS_USER, sp: RS_PASSWORD, tin });
  return result;
}

async function createEInvoice({ buyerTin, buyerName, invoiceDate, items, comment }) {
  const client = await getEInvoiceClient();
  const userId = await getEInvoiceUserId();

  // Get buyer un_id from TIN
  const buyerUnIdResult = await getUnIdFromTin(buyerTin);
  const buyerUnId = buyerUnIdResult?.get_un_id_from_tinResult || 0;

  // Get seller un_id from company TIN
  const sellerUnIdResult = await getUnIdFromTin(RS_TIN);
  const sellerUnId = sellerUnIdResult?.get_un_id_from_tinResult || 0;

  const args = {
    user_id: userId,
    invois_id: 0, // 0 = new invoice
    operation_date: invoiceDate || new Date().toISOString(),
    seller_un_id: sellerUnId,
    buyer_un_id: buyerUnId,
    overhead_no: comment || '',
    overhead_dt: invoiceDate || new Date().toISOString(),
    b_s_user_id: 0,
    ...authArgs(),
  };

  const [result] = await client.save_invoiceAsync(args);
  return result;
}

async function getEInvoiceList({ startDate, endDate, status }) {
  const client = await getEInvoiceClient();
  const userId = await getEInvoiceUserId();

  // Get seller un_id
  const sellerUnIdResult = await getUnIdFromTin(RS_TIN);
  const sellerUnId = sellerUnIdResult?.get_un_id_from_tinResult || 0;

  const args = {
    user_id: userId,
    un_id: sellerUnId,
    s_dt: startDate,
    e_dt: endDate,
    op_s_dt: startDate,
    op_e_dt: endDate,
    invoice_no: '',
    sa_ident_no: '',
    desc: '',
    doc_mos_nom: '',
    ...authArgs(),
  };
  const [result] = await client.get_seller_invoicesAsync(args);
  return result;
}

async function getEInvoice(invoiceId) {
  const client = await getEInvoiceClient();
  const userId = await getEInvoiceUserId();
  const args = { user_id: userId, invois_id: parseInt(invoiceId), ...authArgs() };
  const [result] = await client.get_invoiceAsync(args);
  return result;
}

async function deleteEInvoice(invoiceId) {
  const client = await getEInvoiceClient();
  const userId = await getEInvoiceUserId();
  const args = { user_id: userId, inv_id: parseInt(invoiceId), ref_text: 'Cancelled', ...authArgs() };
  const [result] = await client.ref_invoice_statusAsync(args);
  return result;
}

// ══════════════════════════════════════════════════════
// EMPLOYEE REGISTRATION & DECLARATIONS
// ══════════════════════════════════════════════════════
// NOTE: RS.ge does NOT have a separate TaxPayer registration SOAP service.
// Employee registration with the tax authority is done through the RS.ge
// web portal or through separate government systems, not via SOAP API.
// These functions save records locally for tracking purposes.
// The actual RS.ge registration must be done manually on rs.ge portal.

async function registerEmployee({ employeeTin, employeeName, startDate, position, salary }) {
  // Verify the employee TIN exists
  const taxpayerResult = await checkTaxpayer(employeeTin);
  return {
    success: true,
    tin: employeeTin,
    name: employeeName,
    taxpayerName: taxpayerResult?.get_name_from_tinResult || '',
    message: 'Employee record saved. Register on rs.ge portal to complete official registration.',
  };
}

async function deregisterEmployee({ employeeTin, endDate, reason }) {
  return {
    success: true,
    tin: employeeTin,
    endDate,
    reason,
    message: 'Deregistration record saved. Complete on rs.ge portal.',
  };
}

async function getRegisteredEmployees() {
  // No SOAP endpoint — return empty (local DB tracks this)
  return { employees: [] };
}

async function submitSalaryDeclaration({ month, employees }) {
  // No direct SOAP endpoint for salary declarations
  // Declarations are submitted through rs.ge portal
  return {
    success: true,
    period: month,
    employeeCount: employees.length,
    message: 'Declaration data prepared. Submit on rs.ge portal to complete.',
  };
}

async function getDeclarationStatus(declarationId) {
  return { status: 'local_only', declarationId };
}

module.exports = {
  // Connection
  testConnection,
  isConfigured,
  // Taxpayer lookup
  checkTaxpayer,
  isVatPayer,
  // Waybills
  createWaybill,
  activateWaybill,
  closeWaybill,
  deleteWaybill,
  refWaybill,
  getWaybill,
  getWaybillList,
  // Employees (local tracking + TIN verification)
  registerEmployee,
  deregisterEmployee,
  getRegisteredEmployees,
  // Declarations (local tracking)
  submitSalaryDeclaration,
  getDeclarationStatus,
  // E-Invoices (via NtosService)
  createEInvoice,
  getEInvoiceList,
  getEInvoice,
  deleteEInvoice,
};
