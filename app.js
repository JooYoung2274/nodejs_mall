const express = require("express");
const { Op } = require("sequelize");
const jwt = require("jsonwebtoken");
const { User, Goods, Cart } = require("./models"); //mysql

const authMiddleware = require("./middlewares/auth-middleware");
const Joi = require("joi");

const app = express();
const router = express.Router();

const userSchema = Joi.object({
  nickname: Joi.string().alphanum().min(3).max(30).required(),
  password: Joi.string().pattern(new RegExp("^[a-zA-Z0-9]{4,30}$")).required(),
  confirmPassword: Joi.string().required(),
  email: Joi.string().email().required(),
});

// 회원가입 API
router.post("/users", async (req, res) => {
  try {
    const { nickname, email, password, confirmPassword } =
      await userSchema.validateAsync(req.body);
    if (password !== confirmPassword) {
      res.status(400).send({
        errorMessage: "패스워드가 패스워드 확인란과 동일하지 않습니다.",
      });
      return;
    }
    const existUsers = await User.findAll({
      where: {
        [Op.or]: [{ nickname }, { email }],
      },
    });
    if (existUsers.length) {
      res.status(400).send({
        errorMessage: "이미 가입된 이메일 또는 닉네임이 있습니다.",
      });
      return;
    }
    await User.create({ email, nickname, password });
    res.status(201).send({});
  } catch (err) {
    console.log(err);
    res.status(400).send({
      errorMessage: "입력된 데이터 형식이 틀림.",
    });
  }
});

const authSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().pattern(new RegExp("^[a-zA-Z0-9]{4,30}$")).required(),
});
// login API
router.post("/auth", async (req, res) => {
  try {
    const { email, password } = await authSchema.validateAsync(req.body);
    const user = await User.findOne({ where: { email, password } });
    if (!user) {
      res.status(400).send({
        errorMessage: "입력된 이메일 또는 패스워드가 틀림",
      });
      return;
    }
    const token = jwt.sign({ userId: user.userId }, "SECRET-KEY");
    res.send({ token });
  } catch (err) {
    console.log(err);
    res.status(400).send({
      errorMessage: "데이터 형식이 틀림.",
    });
  }
});

router.get("/users/me", authMiddleware, async (req, res) => {
  const { user } = res.locals;

  res.send({ user });
});

router.get("/goods/cart", authMiddleware, async (req, res) => {
  const { userId } = res.locals.user;

  const cart = await Cart.findAll({
    where: { userId },
  });

  const goodsIds = cart.map((c) => c.goodsId);

  // 루프 줄이기 위해 Mapping 가능한 객체로 만든것
  const goodsKeyById = await Goods.findAll({
    where: { goodsId: goodsIds },
  }).then((goods) =>
    goods.reduce(
      (prev, g) => ({
        ...prev,
        [g.goodsId]: g,
      }),
      {}
    )
  );

  res.send({
    cart: cart.map((c) => ({
      quantity: c.quantity,
      goods: goodsKeyById[c.goodsId],
    })),
  });
});

router.put("/goods/:goodsId/cart", authMiddleware, async (req, res) => {
  const { userId } = res.locals.user;
  const { goodsId } = req.params;
  const { quantity } = req.body;

  const existsCart = await Cart.findOne({
    where: {
      userId,
      goodsId,
    },
  });

  if (existsCart) {
    existsCart.quantity = quantity;
    await existsCart.save();
  } else {
    Cart.create({
      userId,
      goodsId,
      quantity,
    });
    await cart.save();
  }

  res.send({});
});

router.delete("/goods/:goodsId/cart", authMiddleware, async (req, res) => {
  const { userId } = res.locals.user;
  const { goodsId } = req.params;

  const existsCart = await Cart.findOne({
    where: {
      userId,
      goodsId,
    },
  });
  if (existsCart) {
    existsCart.destroy();
  }
  res.send({});
});

router.get("/goods", authMiddleware, async (req, res) => {
  const { category } = req.query;
  const goods = await Goods.findAll({
    order: [["goodsId", "DESC"]],
    where: category ? { category } : undefined,
  });

  res.send({ goods });
});

router.get("/goods/:goodsId", authMiddleware, async (req, res) => {
  const { goodsId } = req.params;
  const goods = await Goods.findByPk(goodsId);

  if (!goods) {
    res.status(404).send({});
  } else {
    res.send({ goods });
  }
});

app.use("/api", express.urlencoded({ extended: false }), router);
app.use(express.static("assets"));

app.listen(8080, () => {
  console.log("서버가 요청을 받을 준비가 됐어요");
});
