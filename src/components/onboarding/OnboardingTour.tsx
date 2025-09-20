import Joyride, { Step, CallBackProps } from 'react-joyride';
import { useTour } from '@/contexts/TourContext';
import { useNavigate } from 'react-router-dom';

export const OnboardingTour = () => {
  const { isTourOpen, stopTour } = useTour();
  const navigate = useNavigate();

  const steps: Step[] = [
    {
      content: (
        <div>
          <h3 className="text-lg font-bold">¡Bienvenido a BotBoxx!</h3>
          <p className="mt-2">Vamos a crear tu primer agente de IA en unos pocos y simples pasos. ¿Listo?</p>
        </div>
      ),
      locale: { skip: "Saltar", last: "Finalizar", next: "Siguiente", back: "Atrás" },
      placement: 'center',
      target: 'body',
    },
    {
      target: '#tour-account-button',
      content: 'Primero lo primero. Aquí es donde puedes gestionar tu perfil y cambiar tu contraseña en cualquier momento.',
      disableBeacon: true,
    },
    {
      target: '#tour-templates-link',
      content: 'Todo comienza aquí. Haz clic para explorar plantillas pre-configuradas para crear tu primer agente.',
      disableBeacon: true,
    },
    {
      target: '#tour-first-template',
      content: 'Esta es una plantilla. Puedes previsualizarla para ver sus instrucciones o usarla directamente para crear un agente basado en ella.',
      disableBeacon: true,
    },
    {
      target: '#tour-create-from-scratch',
      content: 'Si prefieres un control total, puedes crear un agente desde cero y definir toda su personalidad tú mismo.',
      disableBeacon: true,
    },
    {
      content: (
        <div>
          <h3 className="text-lg font-bold">¡Estás listo!</h3>
          <p className="mt-2">Ahora crea tu primer agente. Al hacerlo, serás llevado a su panel de control donde podrás enseñarle, probarlo y compartirlo.</p>
        </div>
      ),
      placement: 'center',
      target: 'body',
    },
  ];

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, type, index } = data;
    const finishedStatuses: string[] = ['finished', 'skipped'];

    if (finishedStatuses.includes(status)) {
      stopTour();
    }

    if (type === 'step:after') {
      // After the "Templates" link step, navigate to the templates page
      if (index === 2) { 
        navigate('/templates');
      }
    }
  };

  return (
    <Joyride
      callback={handleJoyrideCallback}
      continuous
      run={isTourOpen}
      scrollToFirstStep
      showProgress
      showSkipButton
      steps={steps}
      styles={{
        options: {
          arrowColor: '#1f2937',
          backgroundColor: '#1f2937',
          primaryColor: '#3b82f6',
          textColor: '#f9fafb',
          zIndex: 1000,
        },
      }}
    />
  );
};