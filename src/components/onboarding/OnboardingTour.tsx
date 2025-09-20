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
      content: 'Todo comienza aquí. Haz clic para explorar plantillas pre-configuradas o gestionar los agentes que ya has creado.',
      disableBeacon: true,
    },
    {
      target: '#tour-system-prompt',
      content: 'Este es el cerebro de tu agente. Aquí le dices quién es, cómo debe comportarse y qué tareas puede realizar. ¡Sé detallado!',
      disableBeacon: true,
    },
    {
      target: '#tour-knowledge-panel',
      content: "Un agente inteligente necesita conocimiento. Haz clic en '+ Añadir' para 'alimentarlo' con el contenido de tu web, PDFs, o texto.",
      disableBeacon: true,
    },
    {
      target: '#tour-chat-input',
      content: '¡Es hora de probarlo! Escribe un mensaje aquí para conversar con tu agente y ver cómo responde.',
      disableBeacon: true,
    },
    {
      target: '#tour-share-buttons',
      content: '¿Listo para que el mundo lo vea? Usa estos botones para obtener un enlace público o el código para incrustarlo en tu web.',
      disableBeacon: true,
    },
    {
      content: (
        <div>
          <h3 className="text-lg font-bold">¡Misión Cumplida!</h3>
          <p className="mt-2">Has completado los pasos esenciales. ¡Ahora el potencial es ilimitado!</p>
        </div>
      ),
      placement: 'center',
      target: 'body',
    },
  ];

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, step, type, index } = data;
    const finishedStatuses: string[] = ['finished', 'skipped'];

    if (finishedStatuses.includes(status)) {
      stopTour();
    }

    if (type === 'step:after') {
      // Navegar a la página correcta para el siguiente paso
      if (index === 2) { // Después de hacer clic en "Ver Agentes y Plantillas"
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