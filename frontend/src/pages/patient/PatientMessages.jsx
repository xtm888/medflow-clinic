import { MessageSquare } from 'lucide-react';

export default function PatientMessages() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Messages</h1>
        <p className="mt-1 text-sm text-gray-500">Communiquez avec votre équipe médicale</p>
      </div>

      <div className="card text-center py-12">
        <MessageSquare className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <p className="text-lg font-medium text-gray-900 mb-2">Messagerie</p>
        <p className="text-gray-500 mb-4">
          Cette fonctionnalité vous permettra de communiquer directement avec votre médecin.
        </p>
        <p className="text-sm text-gray-600">
          Pour toute question urgente, contactez-nous au <strong>+243 81 234 5678</strong>
        </p>
      </div>
    </div>
  );
}
