"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface InstructionDialogProps {
  open: boolean
  onAccept: () => void
  onCancel: () => void
}

export default function InstructionDialog({ open, onAccept, onCancel }: InstructionDialogProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-xl text-red-600">
            ⚠️ Moderator Code of Conduct
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3 text-base">
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mt-3">
              <div className="font-semibold text-gray-900 mb-2">Your Responsibilities:</div>
              <ul className="list-disc list-inside space-y-1 text-gray-800 text-sm">
                <li>Practice faithful means in all activities</li>
                <li>You are responsible for any question paper leakage</li>
                <li>Maintain strict confidentiality of all content</li>
              </ul>
            </div>

            <div className="bg-red-50 border-l-4 border-red-500 p-3">
              <div className="font-semibold text-red-900 mb-2">Consequences:</div>
              <div className="text-sm text-red-800">
                Violations may result in termination, disciplinary action, and legal consequences.
              </div>
            </div>

            <div className="text-sm text-gray-600 italic mt-3">
              Click "Accept" to proceed or "Cancel" to return to login.
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onAccept} className="bg-blue-600 hover:bg-blue-700">
            Accept
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
