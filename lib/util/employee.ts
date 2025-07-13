import { supabase } from "../supabase";
import { Employee } from "../supabase";

// Employee Functions - Updated to handle admin access
export const getEmployees = async (): Promise<Employee[]> => {
    // Use service role for admin operations to bypass RLS
    const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('name');

    if (error) {
        console.error('Error fetching employees:', error);
        return [];
    }

    return data || [];
};

export const getEmployee = async (clerkUserId: string): Promise<Employee | null> => {
    try {
        const { data, error } = await supabase
            .from('employees')
            .select('*')
            .eq('clerk_user_id', clerkUserId)
            .single();

        if (error) {
            // Only ignore "no rows found" - throw real errors
            if (error.code !== 'PGRST116') {
                console.error('Error fetching employee:', error);
                throw error;
            }
            // No employee found is expected for new users
            return null;
        }

        return data;
    } catch (error) {
        console.error('Exception in getEmployee:', error);
        throw error;
    }
};

export const createEmployee = async (employee: {
    clerkUserId: string;
    name: string;
    email: string;
    department: string;
    position: string;
    status?: 'active' | 'inactive' | 'on_leave';
    maxHoursBeforeOvertime?: number;
    hourlyRate?: number;
}): Promise<Employee | null> => {
    try {
        const { data, error } = await supabase
            .from('employees')
            .insert({
                clerk_user_id: employee.clerkUserId,
                name: employee.name,
                email: employee.email,
                department: employee.department,
                position: employee.position,
                status: employee.status || 'active',
                max_hours_before_overtime: employee.maxHoursBeforeOvertime || 8,
                hourly_rate: employee.hourlyRate || 25.00
            })
            .select()
            .single();

        if (error) {
            // Handle duplicate user/email specifically
            if (error.code === '23505') {
                if (error.message.includes('clerk_user_id')) {
                    throw new Error(`User ${employee.clerkUserId} already exists`);
                }
                if (error.message.includes('email')) {
                    throw new Error(`Email ${employee.email} already exists`);
                }
            }

            console.error('Error creating employee:', error);
            throw new Error('Failed to create employee');
        }

        return data;
    }
    catch (error) {
        console.error('Exception in createEmployee:', error);
        throw error;
    }
};

export const updateEmployee = async (
    employeeId: string,
    updates: Partial<{
        name: string;
        email: string;
        department: string;
        position: string;
        status: 'active' | 'inactive' | 'on_leave';
        maxHoursBeforeOvertime: number;
        hourlyRate: number;
    }>,
    changedBy?: string
): Promise<Employee | null> => {
    try {
        const updateData: any = {};

        if (updates.name) updateData.name = updates.name;
        if (updates.email) updateData.email = updates.email;
        if (updates.department) updateData.department = updates.department;
        if (updates.position) updateData.position = updates.position;
        if (updates.status) updateData.status = updates.status;
        if (updates.maxHoursBeforeOvertime) updateData.max_hours_before_overtime = updates.maxHoursBeforeOvertime;

        // Handle rate change with history tracking
        if (updates.hourlyRate) {
            // Get current employee data to check if rate is actually changing
            const { data: currentEmployee } = await supabase
                .from('employees')
                .select('hourly_rate')
                .eq('id', employeeId)
                .single();

            if (currentEmployee && currentEmployee.hourly_rate !== updates.hourlyRate) {
                updateData.previous_rate = currentEmployee.hourly_rate;
                updateData.rate_effective_date = new Date().toISOString().split('T')[0];
                updateData.rate_changed_at = new Date().toISOString();
                updateData.rate_changed_by = changedBy || 'system';
            }

            updateData.hourly_rate = updates.hourlyRate;
        }

        const { data, error } = await supabase
            .from('employees')
            .update(updateData)
            .eq('id', employeeId)
            .select()
            .single();

        if (error) {
            console.error('Error updating employee:', error);
            return null;
        }

        return data;
    }
    catch (error) {
        console.error('Exception in updateEmployee:', error);
        throw error;
    }
};
