import { Link } from 'react-router-dom';
import { Container, Row, Col, Card, Navbar, Nav, ListGroup, Badge } from 'react-bootstrap';

export const BetsPage = () => {
  return (
    <div className="min-vh-100" style={{backgroundColor: '#f8f9fa'}}>
      {/* Header */}
      <Navbar bg="white" expand="lg" className="shadow-sm">
        <Container>
          <Navbar.Brand className="fw-bold">Мои ставки</Navbar.Brand>
          <Nav className="ms-auto">
            <Nav.Link as={Link} to="/dashboard">Дашборд</Nav.Link>
            <Nav.Link as={Link} to="/transactions">Транзакции</Nav.Link>
            <Nav.Link as={Link} to="/login" className="text-danger">Выход</Nav.Link>
          </Nav>
        </Container>
      </Navbar>

      <Container className="py-4">
        <Row>
          <Col>
            <Card>
              <Card.Header>
                <Card.Title className="mb-0">История ставок</Card.Title>
                <Card.Subtitle className="text-muted">Полная история ваших ставок с детальной информацией</Card.Subtitle>
              </Card.Header>
              <ListGroup variant="flush">
                <ListGroup.Item className="d-flex justify-content-between align-items-center">
                  <div className="d-flex align-items-center">
                    <div className="bg-success text-white rounded-circle d-flex align-items-center justify-content-center me-3" 
                         style={{width: '40px', height: '40px'}}>
                      <strong>W</strong>
                    </div>
                    <div>
                      <div className="fw-semibold">Ставка #12345</div>
                      <div className="text-muted">Коэффициент: 2.0 • Сумма: 100 ₽ • Выигрыш: 200 ₽</div>
                      <small className="text-muted">05.07.2025 18:30</small>
                    </div>
                  </div>
                  <Badge bg="success">Выиграна</Badge>
                </ListGroup.Item>
                
                <ListGroup.Item className="d-flex justify-content-between align-items-center">
                  <div className="d-flex align-items-center">
                    <div className="bg-danger text-white rounded-circle d-flex align-items-center justify-content-center me-3" 
                         style={{width: '40px', height: '40px'}}>
                      <strong>L</strong>
                    </div>
                    <div>
                      <div className="fw-semibold">Ставка #12344</div>
                      <div className="text-muted">Коэффициент: 3.0 • Сумма: 50 ₽ • Проигрыш: -50 ₽</div>
                      <small className="text-muted">05.07.2025 17:15</small>
                    </div>
                  </div>
                  <Badge bg="danger">Проиграна</Badge>
                </ListGroup.Item>
                
                <ListGroup.Item className="d-flex justify-content-between align-items-center">
                  <div className="d-flex align-items-center">
                    <div className="bg-warning text-white rounded-circle d-flex align-items-center justify-content-center me-3" 
                         style={{width: '40px', height: '40px'}}>
                      <strong>P</strong>
                    </div>
                    <div>
                      <div className="fw-semibold">Ставка #12343</div>
                      <div className="text-muted">Коэффициент: 1.5 • Сумма: 200 ₽ • Потенциальный выигрыш: 300 ₽</div>
                      <small className="text-muted">05.07.2025 16:45</small>
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
