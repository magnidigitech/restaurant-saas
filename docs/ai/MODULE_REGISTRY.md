# Module Registry

This document registers and details the initial operational modules available in the platform. Each module has a specific key used in database records and routing.

---

## 1. Inventory Management (Key: `inventory`)

Handles ingredient tracking, supplies, purchasing, wastage, and distribution across outlets.

### Core Responsibilities:
* Track stock levels, transfers, and wastage per outlet.
* Manage vendors and purchase order lifecycle.
* Send alerts for low-stock items.

### Primary Entities:
* **Item Master (`inventory_items`)**: Stores item details, unit of measurement, minimum stock level.
* **Categories (`inventory_categories`)**: Organizes items (e.g., Produce, Dairy, Packaging).
* **Stock Transactions (`inventory_transactions`)**: Records stock movements (Inward, Outward, Transfer, Wastage).
* **Wastage Records (`inventory_wastages`)**: Details spoiled/wasted ingredients with reasons and costs.
* **Vendors (`inventory_vendors`)**: Stores contact and payment details for suppliers.
* **Purchase Orders (`inventory_purchase_orders`)**: Logs ordering flow from creation to approval and delivery.

### Optional Integrations:
* None directly. Serves as a base operational module.

---

## 2. Shift Management (Key: `shifts`)

Controls employee schedules, shift hours, weekly rosters, and swaps.

### Core Responsibilities:
* Define shift templates (e.g., Morning, Evening, Night).
* Schedule employees on weekly/monthly rosters.
* Allow shift swaps and tracking overtime/lateness.

### Primary Entities:
* **Shift Templates (`shift_templates`)**: Defines reusable timeslots (e.g., 9:00 AM - 5:00 PM).
* **Rosters (`shift_rosters`)**: Parent schedule container for a specific period (e.g., Week 31, 2026).
* **Shift Assignments (`shift_assignments`)**: Connects an employee to a shift template on a specific date at an outlet.
* **Availability (`shift_availabilities`)**: Logs when employees are available or preferred off-work.
* **Shift Swaps (`shift_swaps`)**: Coordinates swap requests and approvals between two employees.

### Optional Integrations:
* **Core HR**: Pulls active list of employees for scheduling.
* **Attendance**: Feeds expected shifts to verify actual clock-in times.

---

## 3. HR Onboarding (Key: `hr_onboarding`)

Manages the workflow of adding new employees to a restaurant tenant.

### Core Responsibilities:
* Collect applicant profiles, emergency contacts, and banking details.
* Upload legal documents, ID proofs, and signed agreements.
* Coordinate onboarding task checklists.

### Primary Entities:
* **Employee Profiles (`employee_profiles`)**: Detailed record of employee state (role, joining date, status).
* **Joining Forms (`joining_forms`)**: Structured data filled out by the candidate.
* **Employee Documents (`employee_documents`)**: Files stored securely (e.g., W-4, passport copies, ID cards).
* **Onboarding Tasks (`onboarding_tasks`)**: Checklists for the candidate and HR manager (e.g., IT setup, training completed).
* **Approvals (`onboarding_approvals`)**: Workflow approval states for final employment sign-off.

### Optional Integrations:
* **Core Memberships**: Creating a platform login (`users` and `restaurant_memberships`) automatically once the HR onboarding approval workflow is completed.

---

## 4. Payroll Management (Key: `payroll`)

Calculates salaries, benefits, tax deductions, and manages monthly payouts.

### Core Responsibilities:
* Configure salary structures (basic, allowances, deductions).
* Track and process monthly payroll runs.
* Generate payslips and track payment status.

### Primary Entities:
* **Salary Structures (`payroll_salary_structures`)**: Defines base pay, fixed allowances, and recurring deductions per employee.
* **Payroll Runs (`payroll_runs`)**: The execution container for processing monthly or bi-weekly salaries.
* **Payslips (`payroll_payslips`)**: Individual payslip records detailing earnings, deductions, net salary, and tax details.
* **Earnings (`payroll_earnings`)**: Specific salary components added to a payslip (e.g., overtime bonus, commissions).
* **Deductions (`payroll_deductions`)**: Specific items deducted (e.g., leave deductions, taxes).
* **Payment Records (`payroll_payments`)**: Details bank transfers, checks, or cash payout statuses.

### Optional Integrations:
* **Attendance & Shifts (Loose Integration)**:
  * If `shifts` is enabled, the system can automatically suggest expected hours.
  * If `attendance` is enabled, the system can import actual hours worked, calculate overtime, and calculate unpaid leaves automatically.
  * *Fallback*: If neither is enabled, the payroll clerk can enter monthly payable hours/days manually or import them from a CSV file.
