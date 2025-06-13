"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Users, Upload, Download, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface BulkUserCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUsersCreated: () => void;
}

export function BulkUserCreationDialog({ 
  open, 
  onOpenChange, 
  onUsersCreated 
}: BulkUserCreationDialogProps) {
  const [csvData, setCsvData] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<any>(null);
  const { toast } = useToast();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/csv') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        setCsvData(text);
      };
      reader.readAsText(file);
    } else {
      toast({
        title: "Invalid File",
        description: "Please upload a CSV file",
        variant: "destructive",
      });
    }
  };

  const downloadTemplate = () => {
    const template = `firstName,lastName,emailAddress,password,department,position,hourlyRate,maxHoursBeforeOvertime
John,Doe,john.doe@company.com,TempPass123,Sales,Sales Representative,25.00,8
Jane,Smith,jane.smith@company.com,TempPass123,Customer Service,Customer Service Rep,22.00,8
Mike,Johnson,mike.johnson@company.com,TempPass123,IT,IT Specialist,30.00,8`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'employee_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const processBulkCreation = async () => {
    if (!csvData.trim()) {
      toast({
        title: "No Data",
        description: "Please upload a CSV file or paste CSV data",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    
    try {
      // Parse CSV data
      const lines = csvData.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      
      const users = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        const user: any = {};
        headers.forEach((header, index) => {
          user[header] = values[index];
        });
        return user;
      });

      // Call the bulk creation API
      const response = await fetch('/api/admin/bulk-create-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ users }),
      });

      if (!response.ok) {
        throw new Error('Failed to create users');
      }

      const result = await response.json();
      setResults(result);

      if (result.successCount > 0) {
        toast({
          title: "Users Created",
          description: `Successfully created ${result.successCount} users`,
        });
        onUsersCreated();
      }

      if (result.errorCount > 0) {
        toast({
          title: "Some Errors Occurred",
          description: `${result.errorCount} users failed to create. Check the results below.`,
          variant: "destructive",
        });
      }

    } catch (error) {
      console.error('Error processing bulk creation:', error);
      toast({
        title: "Error",
        description: "Failed to process bulk user creation",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setCsvData("");
    setResults(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-[#005cb3]" />
            Bulk User Creation
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {!results ? (
            <>
              {/* Instructions */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Instructions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-[#005cb3] text-white text-xs flex items-center justify-center font-bold">1</div>
                    <div>
                      <p className="font-medium">Download Template</p>
                      <p className="text-sm text-muted-foreground">Get the CSV template with the correct format</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-[#005cb3] text-white text-xs flex items-center justify-center font-bold">2</div>
                    <div>
                      <p className="font-medium">Fill Employee Data</p>
                      <p className="text-sm text-muted-foreground">Add employee information to the CSV file</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="h-6 w-6 rounded-full bg-[#005cb3] text-white text-xs flex items-center justify-center font-bold">3</div>
                    <div>
                      <p className="font-medium">Upload & Process</p>
                      <p className="text-sm text-muted-foreground">Upload the file and create all users automatically</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Template Download */}
              <div className="space-y-3">
                <Label>Step 1: Download Template</Label>
                <Button 
                  onClick={downloadTemplate}
                  variant="outline"
                  className="w-full"
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download CSV Template
                </Button>
              </div>

              {/* File Upload */}
              <div className="space-y-3">
                <Label>Step 2: Upload Completed CSV</Label>
                <Input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="cursor-pointer"
                />
              </div>

              {/* Manual CSV Input */}
              <div className="space-y-3">
                <Label>Or Paste CSV Data Directly</Label>
                <Textarea
                  value={csvData}
                  onChange={(e) => setCsvData(e.target.value)}
                  placeholder="firstName,lastName,emailAddress,password,department,position,hourlyRate,maxHoursBeforeOvertime&#10;John,Doe,john.doe@company.com,TempPass123,Sales,Sales Representative,25.00,8"
                  className="min-h-[120px] font-mono text-sm"
                />
              </div>

              {/* Warning */}
              <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-amber-900 dark:text-amber-100">Important Notes</h4>
                    <ul className="text-sm text-amber-700 dark:text-amber-300 mt-1 space-y-1">
                      <li>• This will create users in both Clerk and the employee database</li>
                      <li>• Passwords should be temporary - users should change them on first login</li>
                      <li>• Email addresses must be unique</li>
                      <li>• Failed creations will be reported in the results</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Process Button */}
              <Button 
                onClick={processBulkCreation}
                disabled={!csvData.trim() || isProcessing}
                className="w-full bg-[#005cb3] hover:bg-[#005cb3]/90"
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Processing Users...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Create All Users
                  </>
                )}
              </Button>
            </>
          ) : (
            /* Results Display */
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-semibold">Bulk Creation Results</h3>
                <p className="text-sm text-muted-foreground">
                  Processed {results.totalProcessed} users
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">{results.successCount}</div>
                    <div className="text-sm text-muted-foreground">Successful</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-red-600">{results.errorCount}</div>
                    <div className="text-sm text-muted-foreground">Failed</div>
                  </CardContent>
                </Card>
              </div>

              {results.successful.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base text-green-600">Successfully Created</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {results.successful.map((result: any, index: number) => (
                      <div key={index} className="flex justify-between items-center p-2 bg-green-50 dark:bg-green-950/20 rounded">
                        <span className="text-sm">{result.employee.name}</span>
                        <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          Created
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {results.failed.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base text-red-600">Failed to Create</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {results.failed.map((failure: any, index: number) => (
                      <div key={index} className="p-2 bg-red-50 dark:bg-red-950/20 rounded">
                        <div className="flex justify-between items-center">
                          <span className="text-sm">{failure.userData.firstName} {failure.userData.lastName}</span>
                          <Badge variant="outline" className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                            Failed
                          </Badge>
                        </div>
                        <p className="text-xs text-red-600 mt-1">{failure.error}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              <Button onClick={handleClose} className="w-full">
                Close
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}