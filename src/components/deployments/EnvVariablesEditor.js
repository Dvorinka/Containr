import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Save, Eye, EyeOff, Key, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { variablesApi } from '@/lib/api';
function EnvVariablesEditor({ serviceId }) {
    const [variables, setVariables] = useState([]);
    const [showSecrets, setShowSecrets] = useState({});
    const [hasChanges, setHasChanges] = useState(false);
    const queryClient = useQueryClient();
    const { data: existingVars, isLoading } = useQuery({
        queryKey: ['variables', serviceId],
        queryFn: async () => {
            const response = await variablesApi.getVariables(serviceId);
            return response.variables;
        },
    });
    useState(() => {
        if (existingVars) {
            setVariables(existingVars.map((v) => ({
                key: v.key,
                value: v.is_secret ? '' : v.value,
                is_secret: v.is_secret,
            })));
        }
    });
    const updateVariables = useMutation({
        mutationFn: async (vars) => {
            const response = await variablesApi.updateVariables(serviceId, vars);
            return response;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['variables', serviceId] });
            setHasChanges(false);
        },
    });
    const addVariable = () => {
        setVariables([...variables, { key: '', value: '', is_secret: false }]);
        setHasChanges(true);
    };
    const removeVariable = (index) => {
        setVariables(variables.filter((_, i) => i !== index));
        setHasChanges(true);
    };
    const updateVariable = (index, field, newValue) => {
        const updated = [...variables];
        updated[index] = { ...updated[index], [field]: newValue };
        setVariables(updated);
        setHasChanges(true);
    };
    const handleSave = () => {
        const validVars = variables.filter((v) => v.key.trim() !== '');
        updateVariables.mutate(validVars);
    };
    if (isLoading) {
        return (_jsx(Card, { children: _jsx(CardContent, { className: "p-6", children: _jsx("div", { className: "flex items-center justify-center", children: _jsx(Loader2, { className: "w-6 h-6 animate-spin text-muted-foreground" }) }) }) }));
    }
    return (_jsxs(Card, { children: [_jsx(CardHeader, { children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsx(CardTitle, { className: "text-lg", children: "Environment Variables" }), _jsxs("div", { className: "flex gap-2", children: [_jsxs(Button, { variant: "outline", size: "sm", onClick: addVariable, children: [_jsx(Plus, { className: "w-4 h-4 mr-1" }), "Add Variable"] }), hasChanges && (_jsxs(Button, { size: "sm", onClick: handleSave, disabled: updateVariables.isPending, children: [updateVariables.isPending ? (_jsx(Loader2, { className: "w-4 h-4 mr-1 animate-spin" })) : (_jsx(Save, { className: "w-4 h-4 mr-1" })), "Save Changes"] }))] })] }) }), _jsxs(CardContent, { children: [_jsx("div", { className: "space-y-3", children: variables.length === 0 ? (_jsx("div", { className: "text-center py-8 text-muted-foreground", children: "No environment variables configured. Click \"Add Variable\" to add one." })) : (variables.map((variable, index) => (_jsxs("div", { className: "flex items-center gap-2 group", children: [_jsxs("div", { className: "flex-1 grid grid-cols-2 gap-2", children: [_jsx(Input, { placeholder: "KEY", value: variable.key, onChange: (e) => updateVariable(index, 'key', e.target.value), className: "font-mono" }), _jsxs("div", { className: "relative", children: [_jsx(Input, { type: variable.is_secret && !showSecrets[index] ? 'password' : 'text', placeholder: "value", value: variable.value, onChange: (e) => updateVariable(index, 'value', e.target.value), className: "font-mono pr-16" }), variable.is_secret && (_jsx(Button, { type: "button", variant: "ghost", size: "sm", className: "absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0", onClick: () => setShowSecrets({
                                                        ...showSecrets,
                                                        [index]: !showSecrets[index],
                                                    }), children: showSecrets[index] ? (_jsx(EyeOff, { className: "w-4 h-4" })) : (_jsx(Eye, { className: "w-4 h-4" })) }))] })] }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => updateVariable(index, 'is_secret', !variable.is_secret), className: variable.is_secret ? 'text-amber-500' : 'text-muted-foreground', title: variable.is_secret ? 'Secret (hidden)' : 'Regular variable', children: _jsx(Key, { className: "w-4 h-4" }) }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => removeVariable(index), className: "text-destructive opacity-0 group-hover:opacity-100 transition-opacity", children: _jsx(Trash2, { className: "w-4 h-4" }) })] }, index)))) }), variables.length > 0 && (_jsxs("div", { className: "mt-4 p-3 bg-muted/30 rounded-md text-sm text-muted-foreground", children: [_jsx("p", { className: "font-medium mb-1", children: "Tips:" }), _jsxs("ul", { className: "list-disc list-inside space-y-1 text-xs", children: [_jsx("li", { children: "Secret variables are encrypted and hidden in the UI" }), _jsx("li", { children: "Changes are applied after the next deployment" }), _jsx("li", { children: "Use uppercase keys with underscores (e.g., DATABASE_URL)" })] })] }))] })] }));
}
