import { Link } from 'react-router-dom';
import Icon from '../components/Icon';

export default function NotFoundPage() {
  return (
    <div className="not-found">
      <img src="/brand/sivep-tech-03-escudo-nodo.svg" alt="" />
      <p className="eyebrow">Error 404</p>
      <h1>Esta página no existe.</h1>
      <p>Puede que el enlace haya cambiado o que la dirección esté incompleta.</p>
      <div className="not-found-actions">
        <Link to="/" className="btn btn-primary">
          Ir al inicio
          <Icon name="arrowRight" size={17} />
        </Link>
        <Link to="/app" className="btn btn-outline">
          Ir al panel
        </Link>
      </div>
    </div>
  );
}
