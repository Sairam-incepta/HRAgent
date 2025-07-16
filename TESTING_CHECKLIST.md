# HR Agent Application - Testing Checklist

Use this checklist to perform a full regression test of the HR Agent application, ensuring all features work as expected before deployment.

## ✅ **1. Authentication & User Roles**

| # | Test Case | Steps | Expected Result | Status |
|---|---|---|---|:---:|
| 1.1 | **Admin Login** | 1. Navigate to `/sign-in`. <br> 2. Log in with admin credentials (`salar@letsinsure.org`). | Successful login. Redirected to `/dashboard`. Admin dashboard components are visible. | ☐ |
| 1.2 | **Employee Login** | 1. Create a new employee in the admin dashboard. <br> 2. Log out. <br> 3. Log in with the new employee's credentials. | Successful login. Redirected to `/dashboard`. Employee-specific dashboard is visible (no admin panels). | ☐ |
| 1.3 | **Logout** | 1. Log in as any user. <br> 2. Click the "Sign Out" button. | User is logged out and redirected to the sign-in page. | ☐ |
| 1.4 | **Role-Based Access** | 1. Log in as a standard employee. <br> 2. Attempt to access admin-only API routes or pages. | Access is denied. User sees their own dashboard and cannot perform admin actions. | ☐ |

## ✅ **2. AI Chat - Policy Entry Flow**

| # | Test Case | Steps | Expected Result | Status |
|---|---|---|---|:---:|
| 2.1 | **Trigger Flow** | 1. Start a conversation with "new policy" or "sold a policy". | The bot responds by asking for all policy details at once. | ☐ |
| 2.2 | **Happy Path (All Data)** | 1. Provide all required details in a single message (policy type, number, client name, amount, broker fee). <br> 2. Use varied formats (sentences, bullets, mixed). | The bot parses all data correctly and asks about cross-selling. | ☐ |
| 2.3 | **Partial Data** | 1. Provide only some of the required details (e.g., just policy type and amount). | The bot re-prompts for the *missing* information. | ☐ |
| 2.4 | **Cross-Sell: YES** | 1. After providing main policy details, respond "yes" to the cross-sell question. <br> 2. Provide the cross-sold policy details (type, number, amount, fee). | Bot confirms the cross-sold policy details and asks about client reviews. The cross-sold policy is saved with the correct, user-provided policy number. | ☐ |
| 2.5 | **Cross-Sell: NO** | 1. After providing main policy details, respond "no". | Bot skips the cross-sell step and asks about client reviews. | ☐ |
| 2.6 | **Client Review: YES** | 1. After the cross-sell step, respond "yes" to the review question. <br> 2. Provide a rating (1-5) and review text. | Bot confirms the review details and asks for final notes. | ☐ |
| 2.7 | **Client Review: NO** | 1. After the cross-sell step, respond "no". | Bot skips the review step and asks for final notes. | ☐ |
| 2.8 | **Final Notes & Save** | 1. Provide some final notes about the client/sale. | The bot confirms that the entire policy, including any cross-sell and review, has been saved successfully. The success message should include a summary of all data entered. | ☐ |
| 2.9 | **Data Verification** | 1. Check the `policy_sales` and `client_reviews` tables in the database. | All data from the test case is stored correctly, including the main policy, the cross-sold policy (as a separate entry), and the client review. The `cross_sold_policy_number` is the one provided by the user, not auto-generated. | ☐ |

## ✅ **3. AI Chat - Other Flows**

| # | Test Case | Steps | Expected Result | Status |
|---|---|---|---|:---:|
| 3.1 | **Review-Only Flow** | 1. Start a conversation with "add a review". <br> 2. Provide client name and policy number. <br> 3. Provide rating and review text. | The bot saves the review and confirms it. | ☐ |
| 3.2 | **Daily Summary Flow** | 1. Start a conversation with "daily summary". | The bot generates an AI summary based on the day's activities and asks for additional notes. | ☐ |
| 3.3 | **Daily Summary Save** | 1. After getting the AI summary, provide some additional notes. | The bot confirms that the daily summary (AI part + notes) has been saved successfully. | ☐ |
| 3.4 | **General Conversation** | 1. Send a greeting like "hello" or "good morning". | The bot provides a friendly, appropriate greeting and offers to help. | ☐ |
| 3.5 | **Fallback Message** | 1. Send a message that doesn't trigger any flow (e.g., "what's the weather?"). | The bot responds with a message indicating it didn't understand and lists the things it can do. | ☐ |

## ✅ **4. Admin Dashboard**

| # | Test Case | Steps | Expected Result | Status |
|---|---|---|---|:---:|
| 4.1 | **Dashboard Stats** | 1. Log in as admin. <br> 2. Review the main stats on the dashboard. | Stats (Total Sales, Bonuses, Active Employees, etc.) are displayed and appear accurate based on the data in the database. | ☐ |
| 4.2 | **Employee Table** | 1. Navigate to the employee management section. | The table correctly lists all employees from the database. | ☐ |
| 4.3 | **Create Employee** | 1. Use the "Add Employee" dialog to create a new user. | The new employee is created successfully and appears in the employee table. The user can log in. | ☐ |
| 4.4 | **Edit Employee** | 1. Use the "Edit" function on an existing employee. <br> 2. Change their name or position. | The changes are saved and reflected in the employee table. | ☐ |
| 4.5 | **Requests Viewing** | 1. Have an employee submit a request (e.g., for overtime). <br> 2. Log in as admin and view the "Requests" panel. | The admin can see the employee's pending request. | ☐ |
| 4.6 | **Approve/Reject Request** | 1. Approve or reject the pending request. | The request's status is updated in the dashboard and the database. | ☐ |

## ✅ **5. Database & Deployment**

| # | Test Case | Steps | Expected Result | Status |
|---|---|---|---|:---:|
| 5.1 | **Run Reset Script** | 1. From the terminal, run `npm run reset-db-simple`. | The script executes successfully, clearing all data tables and leaving only the `salar@letsinsure.org` admin user. The terminal output confirms this. | ☐ |
| 5.2 | **Verify Clean State** | 1. After running the reset script, log in as the admin. | The dashboard shows zero stats, no employees (except the admin), and no other data. The application is in a clean state, ready for fresh use. | ☐ | 