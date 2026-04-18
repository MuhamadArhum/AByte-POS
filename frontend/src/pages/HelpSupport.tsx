import { useState } from 'react';
import { Search, ChevronDown, ChevronUp, MessageCircle, Mail, BookOpen, Zap, ShoppingCart, Package, Users, DollarSign, Settings, ArrowRight, Keyboard, Video, FileText } from 'lucide-react';

const faqs: { category: string; icon: any; color: string; items: { q: string; a: string }[] }[] = [
  {
    category: 'Sales & POS',
    icon: ShoppingCart,
    color: 'emerald',
    items: [
      { q: 'How do I process a sale at the POS?', a: 'Go to Sales → POS. Search or scan a product, set quantity, select payment method (Cash / Card / Credit), then click "Complete Sale". A receipt is generated automatically.' },
      { q: 'How do I apply a discount on an order?', a: 'In the POS cart, click the discount icon next to any item for item-level discount, or use the "Order Discount" field at the bottom for a cart-wide percentage or fixed discount.' },
      { q: 'How do I process a return?', a: 'Go to Sales → Returns. Find the original sale by invoice number, select the items being returned, choose the reason, and confirm. The stock is automatically restocked.' },
      { q: 'How do I create a quotation?', a: 'Go to Sales → Quotations → New Quotation. Add items, quantities, and any notes. You can print or email the quotation to the customer directly from the modal.' },
      { q: 'What is Credit Sales?', a: 'Credit Sales lets you sell to customers on credit — the balance is tracked per customer. Go to Sales → Credit Sales to record payments or view outstanding balances.' },
    ],
  },
  {
    category: 'Inventory',
    icon: Package,
    color: 'purple',
    items: [
      { q: 'How do I add a new product?', a: 'Go to Inventory → Products → Add Product. Fill in the name, SKU, category, unit, cost price, selling price, and opening stock. Save to add it to inventory.' },
      { q: 'How do I receive stock from a purchase order?', a: 'Go to Inventory → Purchase Orders, find the PO, and click "Receive Stock". Enter quantities received — the system updates stock and posts accounting entries automatically.' },
      { q: 'How does Opening Stock work?', a: 'Opening Stock lets you set initial stock quantities when you first set up the system. Go to Inventory → Opening Stock, select the date, and enter quantities per product.' },
      { q: 'What is Stock Issuance?', a: 'Stock Issuance is for internal consumption — issuing raw materials to production or departments. Go to Inventory → Stock Issue, select items, quantities, and destination section.' },
      { q: 'How do I view stock movement for a product?', a: 'Go to Inventory → Items Ledger. Search for the product and set a date range. All stock-in and stock-out movements with their sources are listed.' },
    ],
  },
  {
    category: 'Human Resources',
    icon: Users,
    color: 'blue',
    items: [
      { q: 'How do I mark daily attendance?', a: 'Go to HR → Daily Attendance. Select the date, then use the quick-mark buttons (P / A / L / H) next to each employee. You can also bulk-mark all as Present with one click.' },
      { q: 'How is payroll calculated?', a: 'Payroll uses: Working Days = Calendar Days − Holidays. Daily Rate = Basic Salary ÷ Working Days. Absent Deduction = Absent Days × Daily Rate. Loan deductions are also applied automatically.' },
      { q: 'How do I issue a loan to an employee?', a: 'Go to HR → Loans → Issue Loan. Select the employee, enter loan amount, monthly deduction, and optionally link Level-4 accounts for automatic double-entry accounting.' },
      { q: 'How do I run payroll processing?', a: 'Go to HR → Payroll Processing. Select the date range and preview the payroll. You can add per-employee bonuses, then click Process to generate salary vouchers and post accounting entries.' },
      { q: 'How do I print a salary slip?', a: 'Go to HR → Salary Voucher. Select the employee and month/year, then click the Print button. A formatted payslip with all deductions and a signature section is generated.' },
    ],
  },
  {
    category: 'Accounts',
    icon: DollarSign,
    color: 'rose',
    items: [
      { q: 'What is the Chart of Accounts?', a: 'The Chart of Accounts is the master list of all financial accounts organized in a 4-level hierarchy: Level 1 (Category) → Level 2 (Group) → Level 3 (Sub-Group) → Level 4 (Ledger). Only Level 4 accounts can be used in transactions.' },
      { q: 'How do I post a journal entry?', a: 'Go to Accounts → Journal Voucher → New Entry. Add debit and credit lines (must balance to zero). Enter a description and date, then click Post. The account balances update instantly.' },
      { q: 'What is the difference between CPV and CRV?', a: 'CPV (Cash Payment Voucher) is for recording cash outflows (expenses, payments). CRV (Cash Receipt Voucher) is for recording cash inflows (collections, receipts). Both auto-post to the General Ledger.' },
      { q: 'How do I view a Profit & Loss report?', a: 'Go to Accounts → Profit & Loss. Select the date range. The report shows Revenue, Cost of Goods Sold, Gross Profit, Operating Expenses, and Net Profit/Loss.' },
      { q: 'How does the Trial Balance work?', a: 'The Trial Balance lists all accounts with their debit and credit totals. If the system is balanced, total debits equal total credits. Use the 6-Column version for Opening, Movement, and Closing balances.' },
    ],
  },
  {
    category: 'System & Settings',
    icon: Settings,
    color: 'gray',
    items: [
      { q: 'How do I change the currency symbol?', a: 'Go to System → Settings. In the General section, update the Currency Symbol field and save. It will reflect across all modules immediately.' },
      { q: 'How do I create a new user / staff role?', a: 'Go to System → Settings → User Management (if available for your plan). Roles and permissions control which modules each user can access.' },
      { q: 'How do I back up the data?', a: 'Go to System → Backup. Click "Create Backup" to export your database. Backups can be downloaded as SQL files for safekeeping.' },
      { q: 'How do I set up email notifications?', a: 'Go to System → Email Notifications. Enter your SMTP host, port, credentials, and sender email. Enable specific notification types (Low Stock, New Order, etc.) and test the connection.' },
      { q: 'What does the Audit Log show?', a: 'The Audit Log records every significant action — who created, edited, or deleted records, with timestamps and IP addresses. Access it at System → Audit Log.' },
    ],
  },
];

const shortcuts = [
  { keys: ['Ctrl', 'P'], action: 'Open POS' },
  { keys: ['Ctrl', 'N'], action: 'New transaction' },
  { keys: ['Escape'], action: 'Close modal' },
  { keys: ['Ctrl', 'S'], action: 'Save / Submit form' },
  { keys: ['Ctrl', 'B'], action: 'Create backup' },
  { keys: ['Ctrl', '/'], action: 'Open this help page' },
];

export default function HelpSupport() {
  const [search, setSearch] = useState('');
  const [openItem, setOpenItem] = useState<string | null>(null);

  const filtered = faqs.map(cat => ({
    ...cat,
    items: cat.items.filter(
      i => !search || i.q.toLowerCase().includes(search.toLowerCase()) || i.a.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(cat => cat.items.length > 0);

  const colorMap: Record<string, { bg: string; text: string; border: string; icon: string }> = {
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: 'bg-emerald-100 text-emerald-600' },
    purple:  { bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200',  icon: 'bg-purple-100 text-purple-600' },
    blue:    { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    icon: 'bg-blue-100 text-blue-600' },
    rose:    { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200',    icon: 'bg-rose-100 text-rose-600' },
    gray:    { bg: 'bg-gray-50',    text: 'text-gray-700',    border: 'border-gray-200',    icon: 'bg-gray-100 text-gray-600' },
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">

      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 rounded-3xl px-10 py-12 mb-10 shadow-2xl">
        <div className="absolute inset-0 opacity-[0.06]" style={{
          backgroundImage: 'radial-gradient(circle, #10b981 1px, transparent 1px)',
          backgroundSize: '28px 28px'
        }} />
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-10 w-48 h-48 bg-teal-500/8 rounded-full blur-2xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-emerald-500/20 border border-emerald-500/30 rounded-xl flex items-center justify-center">
              <Zap size={16} className="text-emerald-400" />
            </div>
            <span className="text-emerald-400 text-xs font-bold uppercase tracking-widest">Help Center</span>
          </div>
          <h1 className="text-3xl font-black text-white mb-2">How can we help you?</h1>
          <p className="text-slate-400 text-sm mb-7">Search our documentation or browse topics below</p>
          <div className="relative max-w-xl">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search FAQs — e.g. 'how to process a return'"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-12 pr-5 py-3.5 bg-white/10 border border-white/15 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:bg-white/15 transition text-sm"
            />
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-3 gap-4 mb-10">
        {[
          { icon: BookOpen, label: 'Documentation', desc: 'Full user manual & guides', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
          { icon: Video, label: 'Video Tutorials', desc: 'Step-by-step walkthroughs', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100' },
          { icon: FileText, label: 'Release Notes', desc: 'What\'s new in each update', color: 'text-purple-600', bg: 'bg-purple-50 border-purple-100' },
        ].map(card => (
          <div key={card.label} className={`flex items-center gap-4 p-4 ${card.bg} border rounded-2xl cursor-pointer hover:shadow-md transition-all group`}>
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
              <card.icon size={20} className={card.color} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800 text-sm">{card.label}</p>
              <p className="text-xs text-gray-500 truncate">{card.desc}</p>
            </div>
            <ArrowRight size={15} className="text-gray-300 group-hover:text-gray-500 transition flex-shrink-0" />
          </div>
        ))}
      </div>

      {/* FAQs */}
      <div className="space-y-6 mb-10">
        <h2 className="text-lg font-bold text-gray-900">Frequently Asked Questions</h2>
        {filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Search size={32} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No results found for "{search}"</p>
            <p className="text-sm mt-1">Try different keywords or browse the categories below</p>
          </div>
        )}
        {filtered.map(cat => {
          const Icon = cat.icon;
          const c = colorMap[cat.color];
          return (
            <div key={cat.category} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className={`flex items-center gap-3 px-5 py-4 ${c.bg} border-b ${c.border}`}>
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${c.icon}`}>
                  <Icon size={16} />
                </div>
                <h3 className={`font-bold text-sm ${c.text}`}>{cat.category}</h3>
                <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${c.icon}`}>{cat.items.length}</span>
              </div>
              <div className="divide-y divide-gray-50">
                {cat.items.map((item, i) => {
                  const key = `${cat.category}-${i}`;
                  const open = openItem === key;
                  return (
                    <div key={i}>
                      <button
                        onClick={() => setOpenItem(open ? null : key)}
                        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50/80 transition-colors group"
                      >
                        <span className="text-sm font-semibold text-gray-800 group-hover:text-gray-900 pr-4">{item.q}</span>
                        {open
                          ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0" />
                          : <ChevronDown size={16} className="text-gray-300 flex-shrink-0 group-hover:text-gray-400" />
                        }
                      </button>
                      {open && (
                        <div className="px-5 pb-5 -mt-1">
                          <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-xl p-4 border border-gray-100">{item.a}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Keyboard Shortcuts */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-10">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 bg-gray-100 rounded-xl flex items-center justify-center">
            <Keyboard size={16} className="text-gray-600" />
          </div>
          <h3 className="font-bold text-gray-900">Keyboard Shortcuts</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {shortcuts.map(s => (
            <div key={s.action} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-center gap-1">
                {s.keys.map(k => (
                  <kbd key={k} className="px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-700 shadow-sm">{k}</kbd>
                ))}
              </div>
              <span className="text-xs text-gray-600">{s.action}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Contact Support */}
      <div className="grid grid-cols-2 gap-5">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg shadow-emerald-200">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mb-4">
            <MessageCircle size={20} className="text-white" />
          </div>
          <h3 className="font-bold text-base mb-1">Live Chat</h3>
          <p className="text-emerald-100 text-sm mb-4">Get instant help from our support team during business hours.</p>
          <button className="flex items-center gap-2 bg-white text-emerald-700 text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-emerald-50 transition">
            Start Chat <ArrowRight size={14} />
          </button>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center mb-4">
            <Mail size={20} className="text-gray-600" />
          </div>
          <h3 className="font-bold text-base text-gray-900 mb-1">Email Support</h3>
          <p className="text-gray-500 text-sm mb-4">Send us a detailed message and we'll respond within 24 hours.</p>
          <a
            href="mailto:support@abyte.app"
            className="flex items-center gap-2 bg-gray-900 text-white text-sm font-bold px-4 py-2.5 rounded-xl hover:bg-gray-800 transition"
          >
            support@abyte.app <ArrowRight size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}
