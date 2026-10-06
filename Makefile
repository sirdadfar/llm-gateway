up:
	docker compose up --build
down:
	docker compose down
install:
	npm install
dev:
	npm run start:dev
test:
	npm test
lint:
	npm run lint
migrate:
	npm run migration:run
