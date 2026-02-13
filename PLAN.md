# HR Module Overhaul - Implementation Plan

## Overview
6 features in HR module. Existing Staff/Attendance/Reports logic stays intact.

## NEW DATABASE TABLES

### 1. `staff_loans`
```sql
CREATE TABLE staff_loans (
  loan_id INT PRIMARY KEY AUTO_INCREMENT,
  staff_id INT NOT NULL,
  loan_amount DECIMAL(12,2) NOT NULL,
  remaining_balance DECIMAL(12,2) NOT NULL,
  monthly_deduction DECIMAL(12,2) DEFAULT 0,
  loan_date DATE NOT NULL,
  status ENUM('active','completed','cancelled') DEFAULT 'active',
  reason TEXT,
  approved_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (staff_id) REFERENCES staff(staff_id),
  FOREIGN KEY (approved_by) REFERENCES users(user_id)
);
```

### 2. `loan_repayments`
```sql
CREATE TABLE loan_repayments (
  repayment_id INT PRIMARY KEY AUTO_INCREMENT,
  loan_id INT NOT NULL,
  staff_id INT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  repayment_date DATE NOT NULL,
  payment_method ENUM('cash','bank_transfer','salary_deduction') DEFAULT 'cash',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (loan_id) REFERENCES staff_loans(loan_id),
  FOREIGN KEY (staff_id) REFERENCES staff(staff_id)
);
```

### 3. `salary_increments`
```sql
CREATE TABLE salary_increments (
  increment_id INT PRIMARY KEY AUTO_INCREMENT,
  staff_id INT NOT NULL,
  old_salary DECIMAL(10,2) NOT NULL,
  new_salary DECIMAL(10,2) NOT NULL,
  increment_amount DECIMAL(10,2) NOT NULL,
  increment_percentage DECIMAL(5,2),
  effective_date DATE NOT NULL,
  reason VARCHAR(255),
  approved_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (staff_id) REFERENCES staff(staff_id),
  FOREIGN KEY (approved_by) REFERENCES users(user_id)
);
```

## PHASES

### Phase 1: Database Migration + New Backend Endpoints
**File: `backend/migrate_hr_module.js`** (NEW)
- Create staff_loans, loan_repayments, salary_increments tables

**File: `backend/controllers/staffController.js`** (MODIFY - ADD new exports, don't touch existing)
New endpoints:
- `getSalarySheet` - GET all active staff with loan deductions
- `getDailyAttendance` - GET all staff attendance for a specific date
- `getEmployeeLedger` - GET combined salary+loans+attendance for one employee
- `createLoan` - POST new loan
- `getLoans` - GET all loans with filters
- `repayLoan` - POST repayment
- `cancelLoan` - PUT cancel
- `getIncrements` - GET salary increment history
- `createIncrement` - POST new increment (also updates staff.salary)

**File: `backend/routes/staffRoutes.js`** (MODIFY - ADD new routes before /:id)
New routes (inserted before parameterized routes):
```
GET    /reports/salary-sheet
GET    /reports/daily-attendance?date=YYYY-MM-DD
GET    /reports/employee-ledger/:staffId
POST   /loans
GET    /loans
POST   /loans/:loanId/repay
PUT    /loans/:loanId/cancel
GET    /increments
POST   /increments
```

### Phase 2: Salary Sheet Page
**File: `frontend/src/pages/SalarySheet.tsx`** (NEW)
- Table: Emp ID, Name, Department, Position, Base Salary, Type, Active Loan Deduction, Net Salary
- Filter: Department dropdown
- Export CSV
- Summary cards: Total Payroll, Total Deductions, Total Net

### Phase 3: Daily Attendance Page
**File: `frontend/src/pages/DailyAttendance.tsx`** (NEW)
- Date picker (defaults to today)
- Table: Emp ID, Name, Department, Check In, Check Out, Hours, Status
- Quick mark buttons for unmarked staff
- Color-coded status
- Summary cards: Present, Absent, Leave, Unmarked

### Phase 4: Loan Management Page
**File: `frontend/src/pages/LoanManagement.tsx`** (NEW)
- List all loans: Staff Name, Amount, Remaining, Monthly Deduction, Status, Date
- Filter: Status (Active/Completed/Cancelled), Staff dropdown
- "Issue Loan" button → modal

**File: `frontend/src/components/IssueLoanModal.tsx`** (NEW)
- Staff dropdown, Amount, Monthly Deduction, Date, Reason

**File: `frontend/src/components/LoanRepaymentModal.tsx`** (NEW)
- Amount, Date, Payment Method, Notes

### Phase 5: Salary Increment
**File: `frontend/src/components/SalaryIncrementModal.tsx`** (NEW)
- Staff dropdown (or pre-selected), Current Salary (read-only), New Salary, Increment %, Effective Date, Reason
- Auto-calculate: type new salary → shows %, type % → shows new salary
- Called from Staff page actions

### Phase 6: Employee Ledger Page
**File: `frontend/src/pages/EmployeeLedger.tsx`** (NEW)
- Staff dropdown to select employee
- Date range filter
- Combined table: Date, Type (Salary/Loan/Repayment/Advance), Description, Debit, Credit, Balance
- Summary: Total Earned, Total Loans, Total Repaid, Outstanding Balance
- Attendance summary section: Present/Absent/Leave counts for period

### Phase 7: Navigation + Routes
**File: `frontend/src/components/Layout.tsx`** (MODIFY)
HR section children add:
- Salary Sheet → /salary-sheet
- Daily Attendance → /daily-attendance
- Loan Management → /loans
- Employee Ledger → /employee-ledger

**File: `frontend/src/App.tsx`** (MODIFY)
Add routes for new pages

### Phase 8: TypeScript Check + Verify Build
