
"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
    id: number;
    title: string;
    description: string;
}

interface StepperHeaderProps {
    steps: Step[];
    currentStep: number;
}

export default function StepperHeader({ steps, currentStep }: StepperHeaderProps) {
    return (
        <div className="flex items-start w-full">
            {steps.map((step, index) => {
                const isCompleted = step.id < currentStep;
                const isActive = step.id === currentStep;
                return (
                    <div key={step.id} className="flex items-center flex-1 last:flex-none">
                        <div className="flex flex-col items-center gap-1 min-w-[6rem]">
                            <div
                                className={cn(
                                    "flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
                                    isCompleted && "border-primary bg-primary text-primary-foreground",
                                    isActive && "border-primary text-primary",
                                    !isCompleted && !isActive && "border-muted-foreground/30 text-muted-foreground"
                                )}
                            >
                                {isCompleted ? <Check className="h-5 w-5" /> : step.id}
                            </div>
                            <div className="text-center">
                                <p className={cn("text-sm font-medium", (isActive || isCompleted) ? "text-foreground" : "text-muted-foreground")}>
                                    {step.title}
                                </p>
                                <p className="text-xs text-muted-foreground hidden sm:block">{step.description}</p>
                            </div>
                        </div>
                        {index < steps.length - 1 && (
                            <div className={cn("h-0.5 flex-1 mx-2 mt-5 transition-colors", isCompleted ? "bg-primary" : "bg-muted-foreground/30")} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}
