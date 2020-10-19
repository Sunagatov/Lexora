package com.zufar.bookshelf.service;

import com.zufar.bookshelf.dao.user.model.Role;
import com.zufar.bookshelf.dao.user.model.User;
import com.zufar.bookshelf.dao.user.RoleRepository;
import com.zufar.bookshelf.dao.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@Transactional
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;

    public User getByLogin(String login) {
        User user = userRepository.getByLogin(login);
        if (user != null) {
            Role adminRole = roleRepository.getOne(1L);
            user.addRole(adminRole);
            return user;
        } else {
            final String errorMessage = "Loading user details is impossible.";
            throw new UsernameNotFoundException(errorMessage);
        }
    }

    public User save(User user) {
        User savedUser = userRepository.save(user);
        log.info("Saving {} was successful", savedUser);
        return savedUser;
    }

    public void delete(User user) {
        userRepository.delete(user);
        log.info("Deleting {} was successful", user);
    }

    public User update(User user) {
        User savedUser = userRepository.save(user);
        log.info("Updating {} was successful", savedUser);
        return savedUser;
    }

    public User get(String login, String password) {
        return userRepository.getByLoginAndPassword(login, password);
    }

    public User get(Long id) {
        return userRepository.getOne(id);
    }

    public List<User> getAll() {
        return userRepository.findAll();
    }

    public boolean isLoginUnique(String login) {
        return userRepository.existsByLogin(login);
    }

}
