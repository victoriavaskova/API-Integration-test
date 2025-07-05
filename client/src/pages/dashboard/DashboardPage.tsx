import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Container, Row, Col, Card, Form, Button, Navbar, Nav, ListGroup, Badge } from 'react-bootstrap';

export const DashboardPage = () => {
  const [betAmount, setBetAmount] = useState('');
  const [selectedOdds, setSelectedOdds] = useState('');

  const handlePlaceBet = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // TODO: Implement actual bet placement
    console.log('Placing bet:', { betAmount, selectedOdds });
    
    // Reset form
    setBetAmount('');
    setSelectedOdds('');
  };

  return (
    <div className="min-vh-100" style={{backgroundColor: '#f8f9fa'}}>
      {/* Header */}
      <Navbar bg="white" expand="lg" className="shadow-sm">
        <Container>
          <Navbar.Brand className="fw-bold">Панель управления ставками</Navbar.Brand>
          <Nav className="ms-auto">
            <Nav.Link as={Link} to="/bets">Мои ставки</Nav.Link>
            <Nav.Link as={Link} to="/transactions">Транзакции</Nav.Link>
            <Nav.Link as={Link} to="/login" className="text-danger">Выход</Nav.Link>
          </Nav>
        </Container>
      </Navbar>

      <Container className="py-4">
        <Row className="g-4">
          {/* Balance Card */}
          <Col md={6}>
            <Card className="h-100">
              <Card.Body>
                <div className="d-flex align-items-center">
                  <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center me-3" 
                       style={{width: '48px', height: '48px'}}>
                    <strong>₽</strong>
                  </div>
                  <div>
                    <Card.Subtitle className="text-muted">Текущий баланс</Card.Subtitle>
                    <Card.Title className="mb-0">1,250.00 ₽</Card.Title>
                  </div>
                </div>
              </Card.Body>
            </Card>
          </Col>

          {/* Place Bet Form */}
          <Col md={6}>
            <Card className="h-100">
              <Card.Body>
                <Card.Title>Сделать ставку</Card.Title>
                <Form onSubmit={handlePlaceBet}>
                  <Form.Group className="mb-3">
                    <Form.Label>Сумма ставки</Form.Label>
                    <Form.Control
                      type="number"
                      placeholder="100"
                      value={betAmount}
                      onChange={(e) => setBetAmount(e.target.value)}
                      required
                    />
                  </Form.Group>
                  
                  <Form.Group className="mb-3">
                    <Form.Label>Коэффициент</Form.Label>
                    <Form.Select
                      value={selectedOdds}
                      onChange={(e) => setSelectedOdds(e.target.value)}
                      required
                    >
                      <option value="">Выберите коэффициент</option>
                      <option value="1.5">1.5</option>
                      <option value="2.0">2.0</option>
                      <option value="2.5">2.5</option>
                      <option value="3.0">3.0</option>
                    </Form.Select>
                  </Form.Group>
                  
                  <Button variant="primary" type="submit" className="w-100">
                    Сделать ставку
                  </Button>
                </Form>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Recent Bets */}
        <Row className="mt-4">
          <Col>
            <Card>
              <Card.Header>
                <Card.Title className="mb-0">Последние ставки</Card.Title>
                <Card.Subtitle className="text-muted">Ваши недавние ставки и их статус</Card.Subtitle>
              </Card.Header>
              <ListGroup variant="flush">
                <ListGroup.Item className="d-flex justify-content-between align-items-center">
                  <div className="d-flex align-items-center">
                    <div className="bg-success text-white rounded-circle d-flex align-items-center justify-content-center me-3" 
                         style={{width: '40px', height: '40px'}}>
                      <strong>W</strong>
                    </div>
                    <div>
                      <div className="fw-semibold">Ставка на коэффициент 2.0</div>
                      <small className="text-muted">Сумма: 100 ₽ • Выигрыш: 200 ₽</small>
                    </div>
                  </div>
                  <Badge bg="success">Выиграна</Badge>
                </ListGroup.Item>
                
                <ListGroup.Item className="d-flex justify-content-between align-items-center">
                  <div className="d-flex align-items-center">
                    <div className="bg-warning text-white rounded-circle d-flex align-items-center justify-content-center me-3" 
                         style={{width: '40px', height: '40px'}}>
                      <strong>P</strong>
                    </div>
                    <div>
                      <div className="fw-semibold">Ставка на коэффициент 1.5</div>
                      <small className="text-muted">Сумма: 200 ₽ • Потенциальный выигрыш: 300 ₽</small>
                    </div>
                  </div>
                  <Badge bg="warning">В ожидании</Badge>
                </ListGroup.Item>
              </ListGroup>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
};
