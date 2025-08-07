"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Save, X, Edit3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { editPolicySale } from "@/lib/util/policies";
import { PolicySale } from "@/lib/supabase";

interface EditPolicyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policy: PolicySale;
  onPolicyUpdated: () => void;
}

export function EditPolicyDialog({
  open,
  onOpenChange,
  policy,
  onPolicyUpdated,
}: EditPolicyDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    policy_number: "",
    client_name: "",
    policy_type: "",
    amount: "",
    broker_fee: "",
    sale_date: "",
    cross_sold_type: "",
    cross_sold_to: "",
    client_description: "",
    is_cross_sold_policy: false,
  });
  const { toast } = useToast();

  // Policy types for the select dropdown
  const policyTypes = [
    "Life Insurance",
    "Health Insurance",
    "Auto Insurance",
    "Home Insurance",
    "Business Insurance",
    "Disability Insurance",
    "Annuity",
    "Other"
  ];

  useEffect(() => {
    if (open && policy) {
      setFormData({
        policy_number: policy.policy_number || "",
        client_name: policy.client_name || "",
        policy_type: policy.policy_type || "",
        amount: policy.amount?.toString() || "",
        broker_fee: policy.broker_fee?.toString() || "",
        sale_date: policy.sale_date ? new Date(policy.sale_date).toISOString().split('T')[0] : "",
        cross_sold_type: policy.cross_sold_type || "",
        cross_sold_to: policy.cross_sold_to || "",
        client_description: policy.client_description || "",
        is_cross_sold_policy: policy.is_cross_sold_policy || false,
      });
    }
  }, [open, policy]);

  const handleSave = async () => {
    // Validation
    if (!formData.policy_number.trim()) {
      toast({
        title: "Validation Error",
        description: "Policy number is required",
        variant: "destructive",
      });
      return;
    }

    if (!formData.client_name.trim()) {
      toast({
        title: "Validation Error",
        description: "Client name is required",
        variant: "destructive",
      });
      return;
    }

    if (!formData.policy_type) {
      toast({
        title: "Validation Error",
        description: "Policy type is required",
        variant: "destructive",
      });
      return;
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast({
        title: "Validation Error",
        description: "Amount must be greater than 0",
        variant: "destructive",
      });
      return;
    }

    if (!formData.broker_fee || parseFloat(formData.broker_fee) <= 0) {
      toast({
        title: "Validation Error",
        description: "Broker fee must be greater than 0",
        variant: "destructive",
      });
      return;
    }

    if (!formData.sale_date) {
      toast({
        title: "Validation Error",
        description: "Sale date is required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const updatedPolicy = await editPolicySale(policy.id, {
        policyNumber: formData.policy_number,
        clientName: formData.client_name,
        policyType: formData.policy_type,
        amount: parseFloat(formData.amount),
        brokerFee: parseFloat(formData.broker_fee),
        saleDate: new Date(formData.sale_date),
        crossSoldType: formData.cross_sold_type || undefined,
        crossSoldTo: formData.cross_sold_to || undefined,
        clientDescription: formData.client_description || undefined,
        isCrossSoldPolicy: formData.is_cross_sold_policy,
      });

      if (updatedPolicy) {
        toast({
          title: "Success",
          description: "Policy updated successfully",
        });
        onPolicyUpdated();
        onOpenChange(false);
      }
    } catch (error: any) {
      console.error('Error updating policy:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update policy",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit3 className="h-5 w-5" />
            Edit Policy - {policy?.policy_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="policy_number">Policy Number *</Label>
              <Input
                id="policy_number"
                value={formData.policy_number}
                onChange={(e) => setFormData({ ...formData, policy_number: e.target.value })}
                placeholder="Enter policy number"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="client_name">Client Name *</Label>
              <Input
                id="client_name"
                value={formData.client_name}
                onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                placeholder="Enter client name"
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="policy_type">Policy Type *</Label>
              <Select
                value={formData.policy_type}
                onValueChange={(value) => setFormData({ ...formData, policy_type: value })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select policy type" />
                </SelectTrigger>
                <SelectContent>
                  {policyTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="sale_date">Sale Date *</Label>
              <Input
                id="sale_date"
                type="date"
                value={formData.sale_date}
                onChange={(e) => setFormData({ ...formData, sale_date: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="broker_fee">Broker Fee *</Label>
              <Input
                id="broker_fee"
                type="number"
                step="0.01"
                min="0"
                value={formData.broker_fee}
                onChange={(e) => setFormData({ ...formData, broker_fee: e.target.value })}
                placeholder="0.00"
                className="mt-1"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_cross_sold_policy"
              checked={formData.is_cross_sold_policy}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, is_cross_sold_policy: checked as boolean })
              }
            />
            <Label htmlFor="is_cross_sold_policy">This is a cross-sold policy</Label>
          </div>

          {formData.is_cross_sold_policy && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="cross_sold_type">Cross-sold Type</Label>
                <Select
                  value={formData.cross_sold_type}
                  onValueChange={(value) => setFormData({ ...formData, cross_sold_type: value })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select cross-sold type" />
                  </SelectTrigger>
                  <SelectContent>
                    {policyTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="cross_sold_to">Cross-sold To</Label>
                <Input
                  id="cross_sold_to"
                  value={formData.cross_sold_to}
                  onChange={(e) => setFormData({ ...formData, cross_sold_to: e.target.value })}
                  placeholder="Enter recipient name"
                  className="mt-1"
                />
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="client_description">Client Description</Label>
            <Textarea
              id="client_description"
              value={formData.client_description}
              onChange={(e) => setFormData({ ...formData, client_description: e.target.value })}
              placeholder="Enter any notes about the client or policy"
              className="mt-1"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={loading}
            >
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={loading}
              className="bg-[#005cb3] hover:bg-[#004a96]"
            >
              {loading ? (
                <>Saving...</>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-1" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}