// Erro "esperado" da API: carrega o código HTTP (400, 401, 404...) e a mensagem.
// O middleware errorHandler transforma isso em resposta para o cliente.
class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

module.exports = AppError;
