// src/components/ApiTestButtons.tsx
"use client";

import React, { useState, ChangeEvent } from "react";

// Import the API functions
import {
    addItem,
    getAllItems,
    getItemById,
    updateItem,
    updateItemQuantity,
    deleteItem,
    bulkUpdateQuantity, // Signature: (file: File) => Promise<any>
} from "@/lib/api/items"; // Adjust path if needed
import { getUsersAndRoles, assignUserRole, getUserRole } from "@/lib/api/users"; // Adjust path if needed
import { getMonthlyInventoryReport } from "@/lib/api/reports"; // Adjust path if needed
import { getLowStockAlerts } from "@/lib/api/alerts"; // Adjust path if needed
import { getAuditLogs } from "@/lib/api/audit"; // Adjust path if needed

// --- Internal Component for Individual Test Blocks ---

interface ApiCallTestProps {
    buttonText: string;
    description?: string;
    // Expects a function that CAN accept an optional file
    apiFunction: (file?: File) => Promise<any>;
    requiresFileInput?: boolean;
    fileInputAccept?: string;
    onSuccess?: (data: any) => void;
}

/*
 * Renders a self-contained block for testing a single API call.
 * Manages its own loading, message, result, and file state.
 */
function ApiCallTest({
    buttonText,
    description,
    apiFunction,
    requiresFileInput = false,
    fileInputAccept = "*/*",
    onSuccess,
}: ApiCallTestProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [result, setResult] = useState<any>(null);
    const [file, setFile] = useState<File | null>(null);

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            setFile(event.target.files[0]);
            setMessage(null);
            setResult(null);
        } else {
            setFile(null);
        }
    };

    const handleClick = async () => {
        setIsLoading(true);
        setMessage(null);
        setResult(null);

        try {
            let data: any;
            // When requiresFileInput is true, we ensure 'file' is passed.
            // The apiFunction prop needs to handle the 'file?: File' signature.
            if (requiresFileInput) {
                if (!file) {
                    // This check prevents calling apiFunction if file is null
                    throw new Error("No file selected.");
                }
                data = await apiFunction(file);
            } else {
                // Call without the file argument
                data = await apiFunction();
            }

            setMessage(`Success: ${buttonText}`);
            setResult(data);
            if (onSuccess) onSuccess(data);
            console.log(`API Call Success (${buttonText}):`, data);
        } catch (error: any) {
            setMessage(`Error: ${error.message}`);
            console.error(`API Call Error (${buttonText}):`, error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div
            style={{
                marginBottom: "20px",
                padding: "15px",
                border: "1px solid #eee",
                borderRadius: "4px",
            }}
        >
            {description && <p style={{ marginTop: 0 }}>{description}</p>}

            {requiresFileInput && (
                <div style={{ marginBottom: "10px" }}>
                    <label>
                        Select File:{" "}
                        <input
                            type="file"
                            accept={fileInputAccept}
                            onChange={handleFileChange}
                            disabled={isLoading}
                            style={{ marginLeft: "5px" }}
                        />
                    </label>
                </div>
            )}

            <button
                onClick={handleClick}
                disabled={isLoading || (requiresFileInput && !file)}
            >
                {isLoading ? "Loading..." : buttonText}
            </button>

            {message && (
                <p
                    style={{
                        marginTop: "10px",
                        padding: "8px",
                        border: `1px solid ${message.startsWith("Error") ? "red" : "green"
                            }`,
                        color: message.startsWith("Error") ? "red" : "green",
                        background: message.startsWith("Error") ? "#ffebee" : "#e8f5e9",
                        borderRadius: "3px",
                        fontSize: "0.9em",
                    }}
                >
                    {message}
                </p>
            )}
            {result && (
                <pre
                    style={{
                        marginTop: "10px",
                        background: "black",
                        border: "1px solid #ccc",
                        padding: "10px",
                        maxHeight: "250px",
                        overflowY: "auto",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-all",
                        fontSize: "0.85em",
                        borderRadius: "3px",
                    }}
                >
                    {JSON.stringify(result, null, 2)}
                </pre>
            )}
        </div>
    );
}

// --- Main Exported Component to Render All Test Blocks ---
export default function ApiTestButtons() {
    // --- Hardcoded values for testing ---
    // !! IMPORTANT: Replace these with actual IDs from your database !!
    const testItemId1 = "c5531d6e-63fa-4c8b-989d-f8134968c588";
    const testItemId2 = "c5531d6e-63fa-4c8b-989d-f8134968c588";
    const testItemId3 = "c5531d6e-63fa-4c8b-989d-f8134968c588";
    const testItemIdToDelete = "c5531d6e-63fa-4c8b-989d-f8134968c588";
    const testUserId1 = "f7e60bf8-9e48-4e97-b76b-16905fd20e96"; // From Supabase Auth users

    return (
        <div>
            <h2>API Test Buttons (Self-Contained Tests)</h2>
            <p>
                Each block below tests a specific API call using hardcoded data.
                Replace placeholder IDs in the code with actual IDs from your database.
            </p>

            <hr />
            <h3>Items</h3>

            {/* POST /api/items */}
            <ApiCallTest
                buttonText="Add Test Item"
                description="Adds a new item with predefined details."
                apiFunction={() =>
                    addItem({
                        name: "Hardcoded Widget V3",
                        quantity: 25,
                        price: 27.5,
                        category: "Widgets",
                    })
                }
            />

            {/* GET /api/items */}
            <ApiCallTest
                buttonText="Get All Items"
                description="Fetches a list of all items."
                apiFunction={getAllItems}
            />

            {/* GET /api/items/<item_id> */}
            <ApiCallTest
                buttonText={`Get Item (ID: ${testItemId1})`}
                description="Fetches details for a specific item."
                apiFunction={() => getItemById(testItemId1)}
            />

            {/* PUT /api/items/<item_id> */}
            <ApiCallTest
                buttonText={`Update Item (ID: ${testItemId2})`}
                description="Updates all details for a specific item."
                apiFunction={() =>
                    updateItem(testItemId2, {
                        name: "Updated Hardcoded Widget V2",
                        quantity: 35,
                        price: 31.99,
                        category: "Updated Widgets V2",
                    })
                }
            />

            {/* PATCH /api/items/<item_id>/quantity */}
            <ApiCallTest
                buttonText={`Update Quantity (ID: ${testItemId3})`}
                description="Updates only the quantity for a specific item."
                apiFunction={() => updateItemQuantity(testItemId3, { quantity: 60 })}
            />

            {/* DELETE /api/items/<item_id> */}
            <ApiCallTest
                buttonText={`Delete Item (ID: ${testItemIdToDelete})`}
                description="Deletes a specific item."
                apiFunction={() => deleteItem(testItemIdToDelete)}
            />

            {/* POST /api/items/bulk-update-quantity */}
            <ApiCallTest
                buttonText="Bulk Update Quantities (CSV)"
                description="Upload a CSV file (expected columns: item_id, quantity) to update multiple items."
                // *** FIX HERE ***
                // Wrap bulkUpdateQuantity to match the expected (file?: File) signature.
                // ApiCallTest ensures 'file' is non-null when this is called via button click.
                apiFunction={(file?: File) => {
                    if (!file) {
                        // This case should technically not be hit if button logic is correct,
                        // but it satisfies TypeScript and adds robustness.
                        return Promise.reject(
                            new Error("File is required for bulk update.")
                        );
                    }
                    // Call the original function which expects a non-optional File
                    return bulkUpdateQuantity(file);
                }}
                requiresFileInput={true}
                fileInputAccept=".csv"
            />

            <hr />
            <h3>Users & Roles</h3>

            {/* GET /api/users */}
            <ApiCallTest
                buttonText="Get Users & Roles"
                description="Fetches a list of users and their assigned roles."
                apiFunction={() => getUsersAndRoles()}
            />

            {/* GET /api/users/<user_id>/role */}
            <ApiCallTest
                buttonText={`Get Users Role (uuid: ${testUserId1})`}
                description="Get the role for a specific user."
                apiFunction={() => getUserRole(testUserId1)}
            />

            {/* PUT /api/users/<user_id>/role */}
            <ApiCallTest
                buttonText={`Assign Role (User ID: ${testUserId1})`}
                description="Assigns the 'admin' role to a specific user."
                apiFunction={() => assignUserRole(testUserId1, { role: "admin" })}
            />

            <hr />
            <h3>Reports & Alerts</h3>

            {/* GET /api/alerts/low-stock */}
            <ApiCallTest
                buttonText="Get Low Stock Alerts"
                description="Fetches items that are below their low stock threshold."
                apiFunction={getLowStockAlerts}
            />

            {/* GET /api/reports/inventory/monthly */}
            <ApiCallTest
                buttonText="Get Monthly Report"
                description="Fetches the monthly inventory report data."
                apiFunction={getMonthlyInventoryReport}
            />

            <hr />
            <h3>Audit</h3>

            {/* GET /api/audit-logs */}
            <ApiCallTest
                buttonText="Get Audit Logs"
                description="Fetches recent audit log entries."
                apiFunction={getAuditLogs}
            />
        </div>
    );
}
