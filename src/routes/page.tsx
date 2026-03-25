import Sidebar from './components/Sidebar';
import WelcomeView from './components/WelcomeView';
import InputArea from './components/InputArea';
import './index.less';

export default function Index() {
  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        <div className="content-scroll-area">
          <WelcomeView />
        </div>
        <div className="input-area-wrapper">
          <InputArea />
        </div>
      </div>
    </div>
  );
}
