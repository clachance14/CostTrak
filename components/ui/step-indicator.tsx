import React from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Step {
  id: number
  title: string
  description?: string
}

interface StepIndicatorProps {
  steps: Step[]
  currentStep: number
  className?: string
}

export function StepIndicator({ steps, currentStep, className }: StepIndicatorProps) {
  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isActive = currentStep === step.id
          const isCompleted = currentStep > step.id
          const isLast = index === steps.length - 1

          return (
            <React.Fragment key={step.id}>
              {/* Step */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-colors",
                    isCompleted && "bg-green-600 text-white",
                    isActive && "bg-blue-600 text-white ring-4 ring-blue-100",
                    !isCompleted && !isActive && "bg-gray-200 text-gray-600"
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    step.id
                  )}
                </div>
                <div className="mt-2 text-center">
                  <p
                    className={cn(
                      "text-sm font-medium transition-colors",
                      isActive && "text-blue-600",
                      isCompleted && "text-green-600",
                      !isActive && !isCompleted && "text-gray-500"
                    )}
                  >
                    {step.title}
                  </p>
                  {step.description && (
                    <p className="text-xs text-gray-500 mt-1 max-w-[120px]">
                      {step.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Connector */}
              {!isLast && (
                <div
                  className={cn(
                    "flex-1 h-1 mx-2 transition-colors",
                    isCompleted ? "bg-green-600" : "bg-gray-200"
                  )}
                />
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}