import { cn } from "@/lib/utils";
import { useState, useEffect, forwardRef, type ReactNode } from "react";
import { Input } from "./input";
import { Label } from "./label";
import { Button } from "./button";
import { Card, CardContent } from "./card";
import { Eye, EyeOff, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

interface FormFieldProps {
  label?: string;
  error?: string;
  success?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

export function FormField({ label, error, success, hint, required, className, children }: FormFieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label className={cn("text-sm font-medium", required && "after:content-['*'] after:ml-0.5 after:text-red-500")}>
          {label}
        </Label>
      )}
      <div className="relative">
        {children}
        {error && (
          <div className="absolute -top-2 -right-2">
            <AlertCircle className="w-4 h-4 text-red-500" />
          </div>
        )}
        {success && (
          <div className="absolute -top-2 -right-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
        )}
      </div>
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}
      {success && (
        <p className="text-xs text-emerald-500 flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />
          {success}
        </p>
      )}
      {hint && !error && !success && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

interface AdvancedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  success?: string;
  hint?: string;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  onRightIconClick?: () => void;
}

export const AdvancedInput = forwardRef<HTMLInputElement, AdvancedInputProps>(
  ({ className, type, label, error, success, hint, loading, leftIcon, rightIcon, onRightIconClick, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    const inputType = type === 'password' && showPassword ? 'text' : type;

    return (
      <FormField label={label} error={error} success={success} hint={hint}>
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
              {leftIcon}
            </div>
          )}
          <Input
            type={inputType}
            className={cn(
              "transition-all duration-200",
              leftIcon && "pl-10",
              (rightIcon || type === 'password' || loading) && "pr-10",
              error && "border-red-500 focus:border-red-500",
              success && "border-emerald-500 focus:border-emerald-500",
              isFocused && "shadow-sm",
              className
            )}
            ref={ref}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            {...props}
          />
          {(rightIcon || type === 'password' || loading) && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : type === 'password' ? (
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              ) : onRightIconClick ? (
                <button
                  type="button"
                  onClick={onRightIconClick}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {rightIcon}
                </button>
              ) : (
                <div className="text-muted-foreground">{rightIcon}</div>
              )}
            </div>
          )}
        </div>
      </FormField>
    );
  }
);

AdvancedInput.displayName = "AdvancedInput";

interface SearchInputProps extends Omit<AdvancedInputProps, 'leftIcon'> {
  onSearch?: (value: string) => void;
  suggestions?: string[];
  showSuggestions?: boolean;
}

export function SearchInput({ onSearch, suggestions = [], showSuggestions = true, ...props }: SearchInputProps) {
  const [value, setValue] = useState(props.value || '');
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [showSuggestionList, setShowSuggestionList] = useState(false);

  useEffect(() => {
    if (value && showSuggestions) {
      const filtered = suggestions.filter(suggestion =>
        String(suggestion).toLowerCase().includes(String(value).toLowerCase())
      );
      setFilteredSuggestions(filtered);
      setShowSuggestionList(filtered.length > 0);
    } else {
      setShowSuggestionList(false);
    }
  }, [value, suggestions, showSuggestions]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    props.onChange?.(e);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setValue(suggestion);
    setShowSuggestionList(false);
    onSearch?.(suggestion);
    const syntheticEvent = {
      target: { value: suggestion },
    } as React.ChangeEvent<HTMLInputElement>;
    props.onChange?.(syntheticEvent);
  };

  return (
    <div className="relative">
      <AdvancedInput
        {...props}
        value={value}
        onChange={handleInputChange}
        type="text"
        placeholder={props.placeholder || "Search..."}
      />
      {showSuggestionList && (
        <Card className="absolute top-full left-0 right-0 mt-1 z-10 max-h-60 overflow-auto">
          <CardContent className="p-0">
            {filteredSuggestions.map((suggestion, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleSuggestionClick(suggestion)}
                className="w-full text-left px-3 py-2 hover:bg-muted transition-colors text-sm"
              >
                {suggestion}
              </button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface FileUploadProps {
  label?: string;
  accept?: string;
  multiple?: boolean;
  maxSize?: number; // in bytes
  maxFiles?: number;
  onFilesSelected?: (files: File[]) => void;
  onFileError?: (error: string) => void;
  className?: string;
  dragText?: string;
  dropText?: string;
}

export function FileUpload({
  label,
  accept,
  multiple = false,
  maxSize = 10 * 1024 * 1024, // 10MB
  maxFiles = 1,
  onFilesSelected,
  onFileError,
  className,
  dragText = "Drag & drop files here",
  dropText = "or click to browse"
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  const handleFiles = (fileList: FileList) => {
    const selectedFiles = Array.from(fileList);
    
    if (!multiple && selectedFiles.length > 1) {
      onFileError?.("Only one file is allowed");
      return;
    }

    if (selectedFiles.length > maxFiles) {
      onFileError?.(`Maximum ${maxFiles} files allowed`);
      return;
    }

    const oversizedFiles = selectedFiles.filter(file => file.size > maxSize);
    if (oversizedFiles.length > 0) {
      onFileError?.(`File size must be less than ${maxSize / 1024 / 1024}MB`);
      return;
    }

    setFiles(selectedFiles);
    onFilesSelected?.(selectedFiles);
  };

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    onFilesSelected?.(newFiles);
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && <Label>{label}</Label>}
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileInput}
          className="hidden"
        />
        <div className="space-y-2">
          <div className="text-muted-foreground">
            <div className="text-sm font-medium">{dragText}</div>
            <div className="text-xs">{dropText}</div>
          </div>
        </div>
      </div>
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-md">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{file.name}</div>
                <div className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} KB
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeFile(index)}
                className="flex-shrink-0"
              >
                ×
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface ToggleGroupProps {
  options: Array<{
    value: string;
    label: string;
    icon?: ReactNode;
  }>;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'outline' | 'ghost';
}

export function ToggleGroup({
  options,
  value,
  onValueChange,
  className,
  size = 'md',
  variant = 'default'
}: ToggleGroupProps) {
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-2',
    lg: 'text-base px-4 py-3'
  };

  const variantClasses = {
    default: 'bg-muted data-[state=on]:bg-primary data-[state=on]:text-primary-foreground',
    outline: 'border data-[state=on]:bg-primary data-[state=on]:border-primary data-[state=on]:text-primary-foreground',
    ghost: 'data-[state=on]:bg-muted data-[state=on]:text-foreground'
  };

  return (
    <div className={cn("inline-flex rounded-md border", variant === 'outline' && 'border-border', className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          data-state={value === option.value ? 'on' : 'off'}
          onClick={() => onValueChange?.(option.value)}
          className={cn(
            "inline-flex items-center gap-2 transition-colors",
            "first:rounded-l-md last:rounded-r-md",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            sizeClasses[size],
            variantClasses[variant]
          )}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  showValue?: boolean;
  marks?: Array<{ value: number; label: string }>;
  className?: string;
}

export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label,
  showValue = true,
  marks = [],
  className
}: SliderProps) {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className={cn("space-y-3", className)}>
      {label && (
        <div className="flex items-center justify-between">
          <Label>{label}</Label>
          {showValue && <span className="text-sm text-muted-foreground">{value}</span>}
        </div>
      )}
      <div className="relative">
        <div className="relative h-2 bg-muted rounded-full">
          <div
            className="absolute h-full bg-primary rounded-full transition-all duration-200"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-2 opacity-0 cursor-pointer"
        />
        <div
          className="absolute top-1/2 transform -translate-y-1/2 w-4 h-4 bg-primary border-2 border-background rounded-full shadow-md transition-all duration-200 hover:scale-110"
          style={{ left: `${percentage}%`, transform: 'translate(-50%, -50%)' }}
        />
      </div>
      {marks.length > 0 && (
        <div className="relative h-4">
          {marks.map((mark) => {
            const markPercentage = ((mark.value - min) / (max - min)) * 100;
            return (
              <div
                key={mark.value}
                className="absolute top-0 transform -translate-x-1/2 text-xs text-muted-foreground"
                style={{ left: `${markPercentage}%` }}
              >
                <div className="w-px h-2 bg-muted-foreground/30 mx-auto mb-1" />
                {mark.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
