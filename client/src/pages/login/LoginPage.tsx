import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Row, Col, Card, Form, Button, Alert } from 'react-bootstrap';

export const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // TODO: Implement actual authentication
    console.log('Login attempt:', { username, password });
    
    // Temporary redirect to dashboard
    navigate('/dashboard');
  };

  return (
    <div className="login-container">
      <Container>
        <Row className="justify-content-center">
          <Col md={6} lg={4}>
            <Card className="login-card">
              <Card.Body className="p-4">
                <div className="text-center mb-4">
                  <h2 className="h3 mb-3">Вход в систему ставок</h2>
                  <p className="text-muted">Введите ваши учетные данные для входа</p>
                </div>
                
                <Form onSubmit={handleSubmit}>
                  <Form.Group className="mb-3">
                    <Form.Label>Имя пользователя</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="Введите имя пользователя"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                    />
                  </Form.Group>
                  
                  <Form.Group className="mb-3">
                    <Form.Label>Пароль</Form.Label>
                    <Form.Control
                      type="password"
                      placeholder="Введите пароль"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </Form.Group>

                  <div className="d-grid">
                    <Button variant="primary" type="submit" size="lg">
                      Войти
                    </Button>
                  </div>
                </Form>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
};
