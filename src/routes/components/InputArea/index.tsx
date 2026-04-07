import { QUICK_PROMPTS } from '@/constants/chat';
import {
  AppstoreOutlined,
  ArrowUpOutlined,
  AudioOutlined,
  BookOutlined,
  BulbOutlined,
  DownloadOutlined,
  PaperClipOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { Prompts, Sender } from '@ant-design/x';
import { Button, Space } from 'antd';
import type React from 'react';
import { useState } from 'react';
import './InputArea.less';

const iconMap: Record<string, React.ReactNode> = {
  ArrowUpOutlined: <ArrowUpOutlined />,
  AppstoreOutlined: <AppstoreOutlined />,
  BookOutlined: <BookOutlined />,
  DownloadOutlined: <DownloadOutlined />,
};

export interface InputAreaProps {
  onSend: (content: string, options?: { enableThinking?: boolean }) => void;
  onStop?: () => void;
  isGenerating?: boolean;
}

const InputArea: React.FC<InputAreaProps> = ({ onSend, onStop, isGenerating }) => {
  const [value, setValue] = useState('');
  const [enableThinking, setEnableThinking] = useState(false);

  const handleSend = (message?: string) => {
    const content = (typeof message === 'string' ? message : value).trim();
    if (!content) return;
    onSend(content, { enableThinking });
    setValue('');
  };

  const promptsItems = QUICK_PROMPTS.map(prompt => ({
    key: prompt.id,
    icon: prompt.icon ? iconMap[prompt.icon] : undefined,
    label: prompt.text,
  }));

  return (
    <div className="input-area-container">
      <div className="prompts-wrapper">
        <Prompts
          items={promptsItems}
          onItemClick={info => {
            const prompt = QUICK_PROMPTS.find(p => p.id === info.data.key);
            if (prompt) {
              if (isGenerating && onStop) {
                onStop();
              }
              setValue(prompt.text);
              handleSend(prompt.text);
            }
          }}
          wrap
        />
      </div>
      <div className="sender-wrapper">
        <Sender
          value={value}
          onChange={setValue}
          submitType="enter"
          onSubmit={handleSend}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              if (!isGenerating) {
                handleSend();
              }
            }
          }}
          placeholder="提问或输入 / 使用技能"
          prefix={
            <Space size="small">
              <Button
                type="text"
                icon={<PaperClipOutlined />}
                className="sender-icon-btn"
              />
              <Button
                size="small"
                shape="round"
                icon={<BulbOutlined />}
                onClick={() => setEnableThinking(!enableThinking)}
                className={`deep-think-btn ${enableThinking ? 'active' : 'inactive'}`}
              >
                深度思考: {enableThinking ? '开启' : '关闭'}
              </Button>
            </Space>
          }
          suffix={
            <div className="sender-actions">
              <Button
                type="text"
                icon={<AudioOutlined />}
                className="sender-icon-btn"
              />
              {isGenerating ? (
                <Button
                  type="primary"
                  shape="circle"
                  icon={<StopOutlined />}
                  onClick={() => onStop?.()}
                  className="sender-stop-btn"
                  aria-label="停止"
                />
              ) : (
                <Button
                  type="primary"
                  shape="circle"
                  icon={<ArrowUpOutlined />}
                  onClick={() => handleSend()}
                  disabled={!value.trim()}
                  className="sender-send-btn"
                  aria-label="发送"
                />
              )}
            </div>
          }
        />
      </div>
    </div>
  );
};

export default InputArea;
